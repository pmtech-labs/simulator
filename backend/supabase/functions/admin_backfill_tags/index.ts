// Edge Function: admin_backfill_tags
//
// POST -> clasifica RETROACTIVAMENTE preguntas ya existentes (creadas antes de que
// existieran process_group/performance_domain/focus_tags) leyendo su contenido real
// y asignando la etiqueta que de verdad corresponde -- a diferencia de la generación
// de contenido nuevo, aquí NUNCA se rota ni se decide al azar: es una tarea de
// CLASIFICACIÓN sobre texto ya escrito, no de creación, así que el riesgo es menor,
// pero sigue validándose que el modelo devuelva un valor de la lista permitida antes
// de aplicarlo (mismo principio de no confiar ciegamente en el autoinforme del modelo).

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLlm } from "../_shared/llmProviders.ts";

interface BackfillBody {
  connector_id: string;
  limit?: number; // cuántas preguntas procesar en esta llamada (por si hay muchas)
}

const PROCESS_GROUPS = ["initiation", "planning", "execution", "monitoring_control", "closing"];
const PERFORMANCE_DOMAINS = ["gobernanza", "alcance", "cronograma", "finanzas", "recursos", "riesgos", "interesados"];
const THEMES = ["entrega_valor", "sostenibilidad", "ia"];

function buildSystemPrompt(): string {
  return `Eres un clasificador de contenido de examen de gestión de proyectos. Tu tarea es leer una
pregunta YA ESCRITA y clasificarla -- NO reescribas ni inventes nada, solo lee y clasifica.

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
{
  "process_group": "initiation" | "planning" | "execution" | "monitoring_control" | "closing",
  "performance_domain": "gobernanza" | "alcance" | "cronograma" | "finanzas" | "recursos" | "riesgos" | "interesados",
  "themes": []  // array, puede ir vacío; solo incluye "entrega_valor"/"sostenibilidad"/"ia" si el
                // enunciado YA TRATA genuinamente ese tema (no lo inventes si no aparece)
}

Elige el grupo de proceso según en qué etapa del ciclo de vida ocurre la situación descrita. Elige el
dominio de desempeño según de qué trata principalmente la decisión (no tiene que coincidir con ninguna
tarea concreta). Si el enunciado es ambiguo, elige la opción más defendible, nunca dejes el campo vacío.`;
}

function buildUserPrompt(stem: string): string {
  return `Clasifica esta pregunta de examen (ya escrita, no la modifiques):\n\n${stem}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();
  const body: BackfillBody = await req.json();
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

  const limit = Math.min(body.limit ?? 30, 60);

  const { data: pending, error: pendingErr } = await admin
    .from("questions")
    .select("id, stem")
    .is("process_group", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (pendingErr) return errorResponse(pendingErr.message, 500);
  if (!pending || pending.length === 0) return jsonResponse({ updated: 0, failed: 0, remaining: 0, errors: [] });

  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const q of pending) {
    try {
      const result = await callLlm(
        { provider: connectorRow.provider, model_id: connectorRow.model_id, api_base_url: connectorRow.api_base_url, apiKey },
        buildSystemPrompt(),
        buildUserPrompt(q.stem),
        400, // clasificación corta, no hace falta mucho espacio
      );

      const cleaned = result.text.replace(/```json|```/g, "").trim();
      const classification = JSON.parse(cleaned);

      if (!PROCESS_GROUPS.includes(classification.process_group)) {
        failed++;
        errors.push(`Pregunta ${q.id}: process_group inválido (${classification.process_group})`);
        continue;
      }
      if (!PERFORMANCE_DOMAINS.includes(classification.performance_domain)) {
        failed++;
        errors.push(`Pregunta ${q.id}: performance_domain inválido (${classification.performance_domain})`);
        continue;
      }
      const themes = Array.isArray(classification.themes)
        ? classification.themes.filter((t: string) => THEMES.includes(t))
        : [];

      const { error: updateErr } = await admin
        .from("questions")
        .update({
          process_group: classification.process_group,
          performance_domain: classification.performance_domain,
          focus_tags: themes,
        })
        .eq("id", q.id);

      if (updateErr) {
        failed++;
        errors.push(`Pregunta ${q.id}: error al guardar (${updateErr.message})`);
        continue;
      }
      updated++;
    } catch (err) {
      failed++;
      errors.push(`Pregunta ${q.id}: ${(err as Error).message}`);
    }
  }

  const { count: remaining } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .is("process_group", null);

  return jsonResponse({ updated, failed, remaining: remaining ?? 0, errors: errors.slice(0, 20) });
});
