// Edge Function: reclassify_question_tags
//
// Reevalúa preguntas YA EXISTENTES contra la nueva taxonomía del PO (Excel
// "Etiquetas_preguntas_simulador_PMP"): Área de Enfoque y Dominio de Desempeño ahora
// admiten VARIAS etiquetas por pregunta (no excluyentes) -- a diferencia del modelo
// anterior de una sola etiqueta, así que no basta con migrar el valor antiguo, hay
// que releer cada pregunta para detectar TODAS las etapas/dominios que toca de verdad.
//
// Igual que el backfill anterior: es una tarea de CLASIFICACIÓN sobre texto YA
// ESCRITO, nunca se inventa ni se rota al azar -- se le pide al modelo que lea y
// decida, y se valida que las etiquetas devueltas sean códigos válidos antes de
// aplicarlas.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLlm } from "../_shared/llmProviders.ts";

interface Body {
  connector_id: string;
  limit?: number;
}

const AE_CODES = ["AEIN", "AEPL", "AEEJ", "AEMC", "AECI"];
const DD_CODES = ["DDGO", "DDAL", "DDCR", "DDFI", "DDRE", "DDRI", "DDIN"];
const NT_CODES = ["NTEV", "NTSO", "NTIA"];

const AE_LABELS: Record<string, string> = {
  AEIN: "Inicio", AEPL: "Planificación", AEEJ: "Ejecución", AEMC: "Monitoreo y control", AECI: "Cierre",
};
const DD_LABELS: Record<string, string> = {
  DDGO: "Gobernanza", DDAL: "Alcance", DDCR: "Cronograma", DDFI: "Finanzas",
  DDRE: "Recursos", DDRI: "Riesgos", DDIN: "Interesados",
};
const NT_LABELS: Record<string, string> = {
  NTEV: "Entrega de valor", NTSO: "Sostenibilidad", NTIA: "Inteligencia artificial",
};

function buildSystemPrompt(): string {
  return `Eres un clasificador de contenido de examen de gestión de proyectos. Tu tarea es leer una
pregunta YA ESCRITA y clasificarla -- NO reescribas ni inventes nada, solo lee y clasifica.

IMPORTANTE: Área de Enfoque y Dominio de Desempeño NO son excluyentes -- una pregunta puede tocar
VARIAS etapas del ciclo de vida o VARIOS dominios de desempeño a la vez si su contenido real lo
justifica (por ejemplo, un escenario que compara lo planificado contra lo ejecutado toca tanto
Planificación como Ejecución). No fuerces una sola etiqueta si genuinamente aplican varias, pero
tampoco añadas etiquetas que no estén claramente justificadas por el texto.

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
{
  "areas_enfoque": ["AEIN"|"AEPL"|"AEEJ"|"AEMC"|"AECI", ...],  // al menos 1, pueden ser varias
  "dominios_desempeno": ["DDGO"|"DDAL"|"DDCR"|"DDFI"|"DDRE"|"DDRI"|"DDIN", ...],  // al menos 1, pueden ser varias
  "nuevas_tematicas": []  // array, puede ir vacío -- solo incluye "NTEV"/"NTSO"/"NTIA" si el
                          // enunciado YA TRATA genuinamente ese tema, no lo inventes
}`;
}

function buildUserPrompt(stem: string, previousAreaHint?: string, previousDomainHint?: string, payloadContent?: string): string {
  const hints = [];
  if (previousAreaHint) hints.push(`Clasificación anterior (de un sistema más simple, de un solo valor) de área de enfoque: ${previousAreaHint} -- verifícala y amplíala si de verdad toca más de una etapa, no la copies ciegamente.`);
  if (previousDomainHint) hints.push(`Clasificación anterior de dominio de desempeño: ${previousDomainHint} -- verifícala y amplíala si de verdad toca más de un dominio, no la copies ciegamente.`);
  const hintLine = hints.length > 0 ? `\n\n${hints.join("\n")}` : "";
  // Requisito: en formatos como "matching", el enunciado (stem) es solo una instrucción
  // genérica ("Empareja cada concepto con su definición") -- el contenido real está en
  // practicum_payload (los términos y definiciones), sin el cual no hay nada que clasificar.
  const payloadLine = payloadContent ? `\n\nContenido real de la pregunta (términos/definiciones):\n${payloadContent}` : "";
  return `Clasifica esta pregunta de examen (ya escrita, no la modifiques):\n\n${stem}${payloadLine}${hintLine}`;
}

// Extrae texto legible del payload de formatos interactivos (matching/enhanced_matching)
// donde el contenido real no vive en `stem`.
function extractPayloadText(format: string, payload: any): string | undefined {
  if (!payload) return undefined;
  if ((format === "matching" || format === "enhanced_matching") && Array.isArray(payload.left) && Array.isArray(payload.right)) {
    const left = payload.left.map((l: any) => l.label).join(", ");
    const right = payload.right.map((r: any) => r.label).join(" | ");
    return `Términos: ${left}\nDefiniciones: ${right}`;
  }
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();
  const body: Body = await req.json();
  if (!body.connector_id) return errorResponse("Falta connector_id", 400);

  const { data: connectorRow, error: connectorErr } = await admin
    .from("llm_connectors")
    .select("id, provider, model_id, api_base_url, secret_id, is_active")
    .eq("id", body.connector_id)
    .single();
  if (connectorErr || !connectorRow) return errorResponse("Conector no encontrado", 404);
  if (!connectorRow.is_active) return errorResponse("El conector está desactivado", 409);

  const { data: apiKey, error: keyErr } = await admin.rpc("vault_read_secret_for_connector", {
    p_secret_id: connectorRow.secret_id,
  });
  if (keyErr || !apiKey) return errorResponse("No se pudo leer la API key del conector", 500);

  const limit = Math.min(body.limit ?? 25, 50);

  // PostgREST no admite subconsultas SQL crudas en .not("id","in", ...) -- se obtiene
  // primero el conjunto de preguntas YA reevaluadas (tienen alguna etiqueta AE) y se
  // excluyen en la siguiente consulta.
  // El enfoque anterior (excluir por URL la lista de IDs ya etiquetados) se rompía al
  // crecer esa lista (cientos de UUIDs en la URL causaban errores de protocolo HTTP2).
  // Se usa en su lugar una función SQL en el propio servidor (NOT EXISTS real).
  const { data: pending, error: pendingErr } = await admin.rpc("get_untagged_ae_questions", { p_limit: limit });
  if (pendingErr) return errorResponse(pendingErr.message, 500);
  if (!pending || pending.length === 0) return jsonResponse({ updated: 0, failed: 0, remaining: 0, errors: [] });

  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const q of pending) {
    try {
      const areaHint = q.process_group ? AE_LABELS[
        { initiation: "AEIN", planning: "AEPL", execution: "AEEJ", monitoring_control: "AEMC", closing: "AECI" }[q.process_group as string] ?? ""
      ] : undefined;
      const domainHint = q.performance_domain ? DD_LABELS[
        { gobernanza: "DDGO", alcance: "DDAL", cronograma: "DDCR", finanzas: "DDFI", recursos: "DDRE", riesgos: "DDRI", interesados: "DDIN" }[q.performance_domain as string] ?? ""
      ] : undefined;

      const payloadContent = extractPayloadText(q.format, q.practicum_payload);

      const result = await callLlm(
        { provider: connectorRow.provider, model_id: connectorRow.model_id, api_base_url: connectorRow.api_base_url, apiKey },
        buildSystemPrompt(),
        buildUserPrompt(q.stem, areaHint, domainHint, payloadContent),
        500,
      );

      const cleaned = result.text.replace(/```json|```/g, "").trim();
      const classification = JSON.parse(cleaned);

      const areas: string[] = Array.isArray(classification.areas_enfoque) ? classification.areas_enfoque.filter((c: string) => AE_CODES.includes(c)) : [];
      const domains: string[] = Array.isArray(classification.dominios_desempeno) ? classification.dominios_desempeno.filter((c: string) => DD_CODES.includes(c)) : [];
      const themes: string[] = Array.isArray(classification.nuevas_tematicas) ? classification.nuevas_tematicas.filter((c: string) => NT_CODES.includes(c)) : [];

      if (areas.length === 0 || domains.length === 0) {
        failed++;
        errors.push(`Pregunta ${q.id}: clasificación incompleta (áreas: ${areas.length}, dominios: ${domains.length})`);
        continue;
      }

      const rows = [...areas, ...domains, ...themes].map((tag_code) => ({ question_id: q.id, tag_code }));
      const { error: insertErr } = await admin.from("question_tags").insert(rows);
      if (insertErr) {
        failed++;
        errors.push(`Pregunta ${q.id}: error al guardar (${insertErr.message})`);
        continue;
      }
      updated++;
    } catch (err) {
      failed++;
      errors.push(`Pregunta ${q.id}: ${(err as Error).message}`);
    }
  }

  const { data: allTaggedNow } = await admin
    .from("question_tags")
    .select("question_id")
    .like("tag_code", "AE%");
  const allTaggedNowIds = new Set((allTaggedNow ?? []).map((r: any) => r.question_id));
  const { count: totalQuestions } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true });
  const remaining = (totalQuestions ?? 0) - allTaggedNowIds.size;

  return jsonResponse({ updated, failed, remaining, errors: errors.slice(0, 20) });
});
