// Edge Function: admin_generate_matching_question
//
// POST -> genera preguntas de emparejamiento (matching) de forma segura: la IA solo
// aporta pares término-definición en TEXTO (sin riesgo estructural, es contenido de
// conocimiento puro), y el CÓDIGO construye el payload completo (ids, barajado del
// lado derecho, correctPairs) -- nunca se confía en que el modelo autoconstruya el
// emparejamiento correcto o evite sesgos de posición.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLlm } from "../_shared/llmProviders.ts";

interface CreateMatchingBody {
  connector_id: string;
  task_ids: string[];
  count_requested: number;
  pairs_per_question?: number; // 4-6, por defecto aleatorio en ese rango
}

const PROCESS_GROUPS = ["initiation", "planning", "execution", "monitoring_control", "closing"] as const;
const PERFORMANCE_DOMAINS = ["gobernanza", "alcance", "cronograma", "finanzas", "recursos", "riesgos", "interesados"] as const;
type Theme = "entrega_valor" | "sostenibilidad" | "ia";
function pickThemes(): Theme[] {
  const themes: Theme[] = [];
  if (Math.random() < 0.5) themes.push("entrega_valor");
  if (Math.random() < 0.1) themes.push("sostenibilidad");
  if (Math.random() < 0.1) themes.push("ia");
  return themes;
}

function buildSystemPrompt(): string {
  return `Eres un redactor experto de exámenes de certificación de project management, familiarizado con el
Exam Content Outline (ECO) 2026 de PMI. NUNCA cites literalmente ni parafrasees de cerca el PMBOK u otro
material protegido.

Tu tarea es generar pares TÉRMINO-DEFINICIÓN relacionados con una tarea del ECO, para un ejercicio de
emparejamiento. Cada definición debe ser inequívoca (que solo pueda emparejarse con un término correcto,
no con varios) y estar redactada en tus propias palabras, nunca copiada de ninguna fuente.

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
{
  "stem": "Empareja cada ... con su ...",
  "pairs": [
    {"term": "...", "definition": "..."}
  ]
}`;
}

function buildUserPrompt(task: any, pairsCount: number, targetThemes: Theme[]): string {
  const enablers = (task.eco_enablers ?? []).map((e: any) => `- ${e.description}`).join("\n");
  const themeLine = targetThemes.length > 0
    ? `\n\nTemática(s) a integrar si es natural: ${targetThemes.join(", ")}`
    : "";
  return `Dominio ECO: ${task.eco_domains.name}
Tarea: ${task.title}
Enablers de referencia:
${enablers}${themeLine}

Genera EXACTAMENTE ${pairsCount} pares término-definición en español (neutro, España/LATAM) relacionados
con conceptos, técnicas o roles de esta tarea. Cada término debe ser corto (una o dos palabras/frase corta);
cada definición debe describir claramente y sin ambigüedad a QUÉ término corresponde.`;
}

function repairUnescapedQuotes(text: string): string {
  let result = "";
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) { result += ch; escapeNext = false; continue; }
    if (ch === "\\") { result += ch; escapeNext = true; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; result += ch; }
      else {
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        const next = text[j];
        if (next === ":" || next === "," || next === "}" || next === "]" || j >= text.length) {
          inString = false; result += ch;
        } else { result += '\\"'; }
      }
      continue;
    }
    result += ch;
  }
  return result;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();
  const body: CreateMatchingBody = await req.json();
  if (!body.connector_id || !body.task_ids?.length || !body.count_requested) {
    return errorResponse("Faltan campos requeridos (connector_id, task_ids, count_requested)", 400);
  }

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

  let generated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < body.count_requested; i++) {
    const taskId = body.task_ids[i % body.task_ids.length];
    const pairsCount = body.pairs_per_question ?? (4 + Math.floor(Math.random() * 3)); // 4-6
    const targetProcessGroup = PROCESS_GROUPS[i % PROCESS_GROUPS.length];
    const targetPerformanceDomain = PERFORMANCE_DOMAINS[i % PERFORMANCE_DOMAINS.length];
    const targetThemes = pickThemes();

    const { data: task } = await admin
      .from("eco_tasks")
      .select("id, title, eco_domains(name), eco_enablers(description)")
      .eq("id", taskId)
      .single();
    if (!task) { failed++; errors.push(`Ítem ${i + 1}: tarea no encontrada`); continue; }

    try {
      const result = await callLlm(
        { provider: connectorRow.provider, model_id: connectorRow.model_id, api_base_url: connectorRow.api_base_url, apiKey },
        buildSystemPrompt(),
        buildUserPrompt(task, pairsCount, targetThemes),
        1500,
      );

      const cleaned = result.text.replace(/```json|```/g, "").trim();
      let draft: any;
      try {
        draft = JSON.parse(cleaned);
      } catch {
        try {
          draft = JSON.parse(repairUnescapedQuotes(cleaned));
        } catch (parseErr) {
          failed++;
          errors.push(`Ítem ${i + 1}: JSON inválido (${(parseErr as Error).message})`);
          continue;
        }
      }

      if (!draft.stem || !Array.isArray(draft.pairs) || draft.pairs.length !== pairsCount) {
        failed++;
        errors.push(`Ítem ${i + 1}: estructura inválida (esperaba ${pairsCount} pares, llegaron ${draft.pairs?.length ?? 0})`);
        continue;
      }
      const invalidPair = draft.pairs.find((p: any) => !p.term || !p.definition || String(p.term).trim().length < 2 || String(p.definition).trim().length < 10);
      if (invalidPair) {
        failed++;
        errors.push(`Ítem ${i + 1}: par con término/definición inválido`);
        continue;
      }

      // Construcción del payload: SIEMPRE por código, nunca confiando en que el
      // modelo construya left/right/correctPairs (evita cualquier sesgo de posición
      // o emparejamiento incorrecto que el modelo pudiera introducir).
      const left = draft.pairs.map((p: any, idx: number) => ({ id: `t${idx + 1}`, label: p.term }));
      const rightShuffled = shuffle(draft.pairs.map((p: any, idx: number) => ({ id: `d${idx + 1}`, label: p.definition, originalIdx: idx })));
      const right = rightShuffled.map((r: any) => ({ id: r.id, label: r.label }));
      const correctPairs = draft.pairs.map((_: any, idx: number) => {
        const match: any = rightShuffled.find((r: any) => r.originalIdx === idx);
        return [`t${idx + 1}`, match.id];
      });
      const correctAnswer = correctPairs.map(([l, r]: [string, string]) => `${l}:${r}`);
      const options = left.map((l: any, idx: number) => ({ id: l.id, text: l.label }));

      const explanation = draft.pairs
        .map((p: any) => `"${p.term}": ${p.definition}`)
        .join(" ");

      await admin.from("questions").insert({
        item_type: "standalone",
        format: "matching",
        stem: draft.stem,
        options,
        correct_answer: correctAnswer,
        explanation,
        task_id: taskId,
        approach: "predictive",
        difficulty: 2 + Math.floor(Math.random() * 2), // 2-3, emparejar es conocimiento, no situacional
        process_group: targetProcessGroup,
        performance_domain: targetPerformanceDomain,
        focus_tags: targetThemes,
        status: "draft",
        practicum_payload: { left, right, correctPairs },
      });
      generated++;
    } catch (err) {
      failed++;
      errors.push(`Ítem ${i + 1}: ${(err as Error).message}`);
    }
  }

  return jsonResponse({ generated, failed, errors: errors.slice(0, 20) });
});
