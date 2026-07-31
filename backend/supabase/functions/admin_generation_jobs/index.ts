// Edge Function: admin_generation_jobs
//
// POST -> crea un job de generación con los parámetros elegidos en el panel
//         (tareas ECO, approach, formato, dificultad, focus_tags, nº de preguntas,
//         y qué conector LLM usar) y lo ejecuta de forma síncrona hasta completarlo
//         (para volúmenes grandes, considerar mover a un worker asíncrono en v1.1;
//         Edge Functions tienen un límite de tiempo de ejecución).
// GET  -> lista jobs con su estado (para el dashboard del panel).
//
// El contenido generado SIEMPRE entra como status='draft'. Nunca se publica
// automáticamente — pasa por scripts/validate_questions.ts (o su equivalente
// aquí embebido) y luego por revisión humana.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLlm } from "../_shared/llmProviders.ts";

interface CreateJobBody {
  connector_id: string;
  task_ids: string[];
  approach?: "predictive" | "agile" | "hybrid";
  format?: string;
  count_requested: number;
  difficulty_min?: number;
  difficulty_max?: number;
  focus_tags?: string[];
}

const VALID_APPROACHES = ["predictive", "agile", "hybrid"];

// El frontend puede mandar "mixed" (u otro valor no reconocido) para pedir mezcla
// automática. La columna generation_jobs.approach es un enum de Postgres que solo
// admite predictive/agile/hybrid — cualquier otro valor se normaliza a null (mezcla).
function normalizeApproach(value: unknown): "predictive" | "agile" | "hybrid" | null {
  return typeof value === "string" && VALID_APPROACHES.includes(value)
    ? (value as "predictive" | "agile" | "hybrid")
    : null;
}

const FORBIDDEN_PATTERNS = [
  /examen\s+oficial\s+de\s+pmi/i,
  /certificaci[oó]n\s+oficial\s+garantizada/i,
  /avalado\s+por\s+pmi/i,
];

function buildSystemPrompt() {
  return `Eres un redactor experto de exámenes de certificación de project management, familiarizado con el
Exam Content Outline (ECO) 2026 de PMI. Tu única fuente de verdad es la tarea y los enablers del ECO que se
te proporcionan — NUNCA cites literalmente ni parafrasees de cerca el PMBOK u otro material protegido, y
nunca menciones marcas registradas de PMI fuera del contexto normal de un examen de práctica no oficial.
Genera escenarios realistas que evalúen juicio situacional, no memorización.

DISEÑO DE DISTRACTORES (obligatorio): cada opción incorrecta debe ser plausible pero fallar por una razón
concreta y clasificable en uno de estos tipos de error:
- "sequence": es una acción válida, pero no la que corresponde hacer PRIMERO.
- "role": la decisión o acción corresponde a otra persona/rol, no al director de proyecto en este contexto.
- "approach": aplica lógica predictiva en un contexto ágil, o viceversa.
- "analysis": actúa sin considerar toda la información relevante del escenario (se precipita).
- "knowledge": refleja un concepto o principio incorrecto.
- "interpretation": malinterpreta la situación descrita.
- "reading": ignora un dato o palabra decisiva del enunciado.
- "time": implica dedicar tiempo/urgencia de forma desproporcionada (o precipitarse sin analizar).
Asigna un "error_type" (uno de estos 8 valores exactos) a CADA opción incorrecta. La opción correcta no
lleva error_type.

CALIDAD DE LA EXPLICACIÓN (obligatoria): la explicación debe, en un solo texto fluido:
1. Indicar cuál es la mejor respuesta y qué dato del enunciado resulta decisivo para elegirla.
2. Explicar el razonamiento que conduce a la solución (qué principio profesional se evalúa).
3. Explicar por qué CADA una de las demás opciones es menos adecuada, conectándolo con su error_type
   (ej. "es una acción válida pero prematura" para sequence, "correspondería al patrocinador" para role).

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks, con esta forma exacta:
{"stem":"...","options":[{"id":"A","text":"...","error_type":"sequence"},{"id":"B","text":"..."},{"id":"C","text":"...","error_type":"role"},{"id":"D","text":"...","error_type":"analysis"}],"correct_answer":["B"],"explanation":"...","difficulty":3}`;
}

function buildUserPrompt(task: any, approach: string, format: string, difficultyMin: number, difficultyMax: number, focusTags: string[]) {
  const enablers = (task.eco_enablers ?? []).map((e: any) => `- ${e.description}`).join("\n");
  const focusLine = focusTags.length > 0 ? `\nTemas transversales a entretejer si es natural: ${focusTags.join(", ")}` : "";
  return `Dominio ECO: ${task.eco_domains.name}
Tarea: ${task.title}
Enablers de referencia:
${enablers}

Enfoque de gestión de proyectos: ${approach}
Formato: ${format}
Dificultad objetivo: entre ${difficultyMin} y ${difficultyMax} (escala 1-5)${focusLine}

Genera UNA pregunta de examen tipo PMP en español (neutro, España/LATAM), situacional, evaluando esta tarea.`;
}

const VALID_ERROR_TYPES = ["knowledge", "interpretation", "sequence", "role", "approach", "reading", "analysis", "time"];

function validateDraft(draft: any): string[] {
  const issues: string[] = [];
  if (!draft.stem || draft.stem.length < 20) issues.push("Enunciado demasiado corto");
  if (!Array.isArray(draft.options) || draft.options.length < 2) issues.push("Menos de 2 opciones");
  if (!Array.isArray(draft.correct_answer) || draft.correct_answer.length === 0) {
    issues.push("correct_answer vacío");
  } else if (Array.isArray(draft.options)) {
    const ids = new Set(draft.options.map((o: any) => o.id));
    if (!draft.correct_answer.every((id: string) => ids.has(id))) {
      issues.push("correct_answer no coincide con options");
    }
    for (const opt of draft.options) {
      const isCorrectOption = draft.correct_answer?.includes(opt.id);
      if (!isCorrectOption) {
        if (!opt.error_type) issues.push(`Opción ${opt.id} (distractor) sin error_type`);
        else if (!VALID_ERROR_TYPES.includes(opt.error_type)) issues.push(`Opción ${opt.id} con error_type inválido: ${opt.error_type}`);
      }
    }
  }
  if (!draft.explanation || draft.explanation.length < 20) issues.push("Explicación ausente o corta");
  const fullText = `${draft.stem ?? ""}\n${draft.explanation ?? ""}`;
  for (const p of FORBIDDEN_PATTERNS) if (p.test(fullText)) issues.push("Contiene patrón no permitido");
  return issues;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? url.searchParams.get("page_size") ?? 20);
    const offset = Number(
      url.searchParams.get("offset") ??
        (Number(url.searchParams.get("page") ?? 1) - 1) * limit,
    );

    const { data, error, count } = await admin
      .from("generation_jobs")
      .select("*, llm_connectors(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return errorResponse(error.message, 500);

    const jobs = data ?? [];
    const allTaskIds = [...new Set(jobs.flatMap((j: any) => j.task_ids ?? []))];
    const { data: tasks } = allTaskIds.length
      ? await admin.from("eco_tasks").select("id, title").in("id", allTaskIds)
      : { data: [] as any[] };
    const taskTitleById = new Map((tasks ?? []).map((t: any) => [t.id, t.title]));

    const enriched = jobs.map((j: any) => ({
      ...j,
      connector_name: j.llm_connectors?.name ?? null,
      task_titles: (j.task_ids ?? []).map((id: string) => taskTitleById.get(id) ?? id),
    }));

    return jsonResponse({ data: enriched, total: count ?? enriched.length });
  }

  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const body: CreateJobBody = await req.json();
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

  const { data: job, error: jobErr } = await admin
    .from("generation_jobs")
    .insert({
      connector_id: body.connector_id,
      requested_by: user.id,
      task_ids: body.task_ids,
      approach: normalizeApproach(body.approach),
      format: body.format ?? "mc_single",
      count_requested: body.count_requested,
      difficulty_min: body.difficulty_min ?? 1,
      difficulty_max: body.difficulty_max ?? 5,
      focus_tags: body.focus_tags ?? [],
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobErr) return errorResponse(jobErr.message, 500);

  const normalizedApproach = normalizeApproach(body.approach);
  const approaches = normalizedApproach ? [normalizedApproach] : ["predictive", "agile", "hybrid"];
  let generated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < body.count_requested; i++) {
    const taskId = body.task_ids[i % body.task_ids.length];
    const approach = approaches[i % approaches.length];

    const { data: task } = await admin
      .from("eco_tasks")
      .select("id, title, eco_domains(name), eco_enablers(description)")
      .eq("id", taskId)
      .single();

    if (!task) { failed++; errors.push(`Tarea ${taskId} no encontrada`); continue; }

    try {
      const result = await callLlm(
        { provider: connectorRow.provider, model_id: connectorRow.model_id, api_base_url: connectorRow.api_base_url, apiKey },
        buildSystemPrompt(),
        buildUserPrompt(task, approach, body.format ?? "mc_single", body.difficulty_min ?? 1, body.difficulty_max ?? 5, body.focus_tags ?? []),
      );

      const cleaned = result.text.replace(/```json|```/g, "").trim();
      const draft = JSON.parse(cleaned);
      const issues = validateDraft(draft);

      if (issues.length > 0) {
        failed++;
        errors.push(`Ítem ${i + 1}: ${issues.join("; ")}`);
        continue;
      }

      await admin.from("questions").insert({
        item_type: "standalone",
        format: body.format ?? "mc_single",
        stem: draft.stem,
        options: draft.options,
        correct_answer: draft.correct_answer,
        explanation: draft.explanation,
        task_id: taskId,
        approach,
        difficulty: draft.difficulty ?? 3,
        focus_tags: body.focus_tags ?? [],
        status: "draft", // nunca se publica automáticamente
        generation_job_id: job.id,
      });
      generated++;
    } catch (err) {
      failed++;
      errors.push(`Ítem ${i + 1}: ${(err as Error).message}`);

      // Si las 2 primeras llamadas al conector fallan, es un problema sistémico
      // (modelo inexistente, API key inválida, proveedor caído) — no tiene sentido
      // repetir el mismo error hasta completar count_requested, solo gasta cuota y tiempo.
      if (generated === 0 && failed >= 2) {
        errors.push(
          `Lote detenido tras ${failed} fallos consecutivos: revisa el modelo/clave del conector antes de reintentar.`,
        );
        break;
      }
    }
  }

  const { data: updatedJob, error: updateErr } = await admin
    .from("generation_jobs")
    .update({
      status: "completed",
      count_generated: generated,
      count_failed: failed,
      error_message: errors.length > 0 ? errors.slice(0, 20).join(" | ") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .select()
    .single();

  if (updateErr) return errorResponse(updateErr.message, 500);
  return jsonResponse({ job: updatedJob });
});
