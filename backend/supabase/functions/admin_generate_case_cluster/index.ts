// Edge Function: admin_generate_case_cluster
//
// POST -> genera clusters de caso completos: un escenario (case_clusters) + entre 3
// y 5 preguntas hijas (item_type='case_child') que comparten ese mismo escenario.
//
// A diferencia de admin_generation_jobs (una pregunta suelta por llamada), aquí se
// pide al modelo el escenario y TODAS sus preguntas hijas en UNA sola llamada, para
// que las preguntas sean genuinamente coherentes entre sí (mismo proyecto, mismos
// personajes, mismos datos) -- generar cada pregunta hija por separado arriesgaría
// incoherencias entre ellas (nombres distintos, datos que no cuadran).
//
// Mismo patrón de seguridad que ya usamos en admin_generation_jobs: posición de la
// respuesta correcta y dificultad se fijan ANTES de generar (rotación determinista
// por pregunta hija), nunca se confía en que el modelo las autodeclare bien.
// process_group, performance_domain y focus_tags se fijan a nivel de CLUSTER (todas
// las preguntas hijas comparten el mismo escenario, así que comparten estas etiquetas).

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLlm } from "../_shared/llmProviders.ts";

interface CreateClusterJobBody {
  connector_id: string;
  task_ids: string[];
  approach?: "predictive" | "agile" | "hybrid";
  clusters_requested: number;
  questions_per_cluster?: number; // 3-5, por defecto aleatorio en ese rango
  difficulty_min?: number;
  difficulty_max?: number;
}

const VALID_APPROACHES = ["predictive", "agile", "hybrid"];
const VALID_ERROR_TYPES = ["knowledge", "interpretation", "sequence", "role", "approach", "reading", "analysis", "time"];
const FORBIDDEN_PATTERNS = [
  /examen\s+oficial\s+de\s+pmi/i,
  /certificaci[oó]n\s+oficial\s+garantizada/i,
  /avalado\s+por\s+pmi/i,
];

const PROCESS_GROUPS = ["initiation", "planning", "execution", "monitoring_control", "closing"] as const;
// Actualización del PO: Áreas de Enfoque pasan de 20/20/20/20/20 a 10/30/20/30/10.
const WEIGHTED_PROCESS_GROUPS = [
  "initiation",
  "planning", "planning", "planning",
  "execution", "execution",
  "monitoring_control", "monitoring_control", "monitoring_control",
  "closing",
] as const;
const PROCESS_GROUP_LABELS: Record<string, string> = {
  initiation: "Inicio", planning: "Planificación", execution: "Ejecución",
  monitoring_control: "Monitoreo y Control", closing: "Cierre",
};
const PERFORMANCE_DOMAINS = ["gobernanza", "alcance", "cronograma", "finanzas", "recursos", "riesgos", "interesados"] as const;
const PERFORMANCE_DOMAIN_LABELS: Record<string, string> = {
  gobernanza: "Gobernanza", alcance: "Alcance", cronograma: "Cronograma", finanzas: "Finanzas",
  recursos: "Recursos", riesgos: "Riesgos", interesados: "Interesados",
};

type Theme = "entrega_valor" | "sostenibilidad" | "ia";
function pickThemes(): Theme[] {
  const themes: Theme[] = [];
  if (Math.random() < 0.5) themes.push("entrega_valor");
  if (Math.random() < 0.1) themes.push("sostenibilidad");
  if (Math.random() < 0.1) themes.push("ia");
  return themes;
}
const THEME_INSTRUCTIONS: Record<string, string> = {
  entrega_valor: "El escenario debe integrar de forma natural el concepto de entrega basada en el valor.",
  sostenibilidad: "El escenario debe integrar de forma natural una consideración de sostenibilidad.",
  ia: "El escenario debe integrar de forma natural el uso de inteligencia artificial como herramienta de apoyo.",
};

function normalizeApproach(value: unknown): "predictive" | "agile" | "hybrid" | null {
  return typeof value === "string" && VALID_APPROACHES.includes(value)
    ? (value as "predictive" | "agile" | "hybrid")
    : null;
}

function buildSystemPrompt(): string {
  return `Eres un redactor experto de exámenes de certificación de project management, familiarizado con el
Exam Content Outline (ECO) 2026 de PMI. NUNCA cites literalmente ni parafrasees de cerca el PMBOK u otro
material protegido, y nunca menciones marcas registradas de PMI fuera del contexto normal de un examen de
práctica no oficial. Genera contenido situacional que evalúe juicio, no memorización.

Tu tarea es generar un CASO/ESCENARIO completo con varias preguntas asociadas, tal como se define en el
ECO 2026: un enunciado de escenario único y detallado (con un proyecto concreto, personajes con nombre,
datos específicos), seguido de varias preguntas independientes que se responden EN EL CONTEXTO de ese
mismo escenario -- cada pregunta plantea una decisión o análisis distinto sobre la misma situación.

FORMATO DE TEXTO (crítico): dentro de "scenario_text", "stem", "options[].text" y "explanation" NUNCA
uses comillas dobles ("). Usa comillas simples (') o comillas angulares (« ») si necesitas citar algo.

DISEÑO DE DISTRACTORES (obligatorio en cada pregunta): cada opción incorrecta debe fallar por una razón
clasificable en uno de estos 8 tipos: "sequence" (acción válida pero prematura), "role" (corresponde a
otro rol), "approach" (lógica predictiva en contexto ágil o viceversa), "analysis" (se precipita sin
analizar toda la información), "knowledge" (concepto incorrecto), "interpretation" (malinterpreta la
situación), "reading" (ignora un dato clave del enunciado), "time" (urgencia desproporcionada).

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks, con esta forma exacta:
{
  "scenario_title": "...",
  "scenario_text": "...",
  "questions": [
    {
      "stem": "...",
      "options": [{"id":"A","text":"...","error_type":"sequence"},{"id":"B","text":"..."},{"id":"C","text":"...","error_type":"role"},{"id":"D","text":"...","error_type":"analysis"}],
      "correct_answer": ["B"],
      "explanation": "...",
      "difficulty": <entero 1-5>
    }
  ]
}`;
}

function buildUserPrompt(
  task: any, approach: string, questionsCount: number, targetLetters: string[],
  targetDifficulties: number[], targetProcessGroup: string, targetThemes: Theme[], targetPerformanceDomain: string,
): string {
  const enablers = (task.eco_enablers ?? []).map((e: any) => `- ${e.description}`).join("\n");
  const themeLine = targetThemes.length > 0
    ? `\n\nTEMÁTICA(S) (obligatorio, todas): ${targetThemes.map((t) => THEME_INSTRUCTIONS[t]).join(" ")}`
    : "";
  const perQuestionRules = targetLetters
    .map((letter, idx) => `  - Pregunta ${idx + 1}: la respuesta correcta debe quedar en la posición "${letter}" (correct_answer=["${letter}"]), y su "difficulty" debe ser exactamente ${targetDifficulties[idx]}.`)
    .join("\n");

  return `Dominio ECO: ${task.eco_domains.name}
Tarea principal: ${task.title}
Enablers de referencia:
${enablers}

Enfoque de gestión de proyectos: ${approach}
Genera un caso/escenario en español (neutro, España/LATAM) con EXACTAMENTE ${questionsCount} preguntas
asociadas, relacionadas con esta tarea (pueden tocar matices distintos de la misma situación).${themeLine}

GRUPO DE PROCESO / ÁREA DE ENFOQUE (obligatorio): el escenario completo debe situarse claramente en la
etapa de "${PROCESS_GROUP_LABELS[targetProcessGroup]}" del ciclo de vida del proyecto.

DOMINIO DE DESEMPEÑO (obligatorio): el caso debe girar principalmente en torno a
"${PERFORMANCE_DOMAIN_LABELS[targetPerformanceDomain]}" (etiqueta independiente de la tarea ECO indicada).

REGLAS OBLIGATORIAS POR PREGUNTA (no las cambies, constrúyelas desde el principio así):
${perQuestionRules}

No generes ninguna pregunta con la respuesta correcta en otra posición y la corrijas después -- constrúyela
ya así desde el principio, igual que la dificultad indicada para cada una.`;
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

function validateQuestion(q: any, targetLetter: string, targetDifficulty: number): string[] {
  const issues: string[] = [];
  if (!q.stem || q.stem.length < 20) issues.push("Enunciado demasiado corto");
  if (!Array.isArray(q.options) || q.options.length < 2) issues.push("Menos de 2 opciones");
  if (!Array.isArray(q.correct_answer) || q.correct_answer.length === 0) {
    issues.push("correct_answer vacío");
  } else if (Array.isArray(q.options)) {
    const ids = new Set(q.options.map((o: any) => o.id));
    if (!q.correct_answer.every((id: string) => ids.has(id))) issues.push("correct_answer no coincide con options");
    if (!q.correct_answer.includes(targetLetter)) issues.push(`Respuesta correcta no en posición ${targetLetter}`);
    for (const opt of q.options) {
      if (!opt.text || String(opt.text).trim().length < 3) issues.push(`Opción ${opt.id} sin texto`);
      const isCorrect = q.correct_answer?.includes(opt.id);
      if (!isCorrect) {
        if (!opt.error_type) issues.push(`Opción ${opt.id} sin error_type`);
        else if (!VALID_ERROR_TYPES.includes(opt.error_type)) issues.push(`error_type inválido: ${opt.error_type}`);
      }
    }
  }
  if (!q.explanation || q.explanation.length < 20) issues.push("Explicación ausente o corta");
  if (Number(q.difficulty) !== targetDifficulty) issues.push(`difficulty ${q.difficulty} != ${targetDifficulty}`);
  return issues;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();

  const body: CreateClusterJobBody = await req.json();
  if (!body.connector_id || !body.task_ids?.length || !body.clusters_requested) {
    return errorResponse("Faltan campos requeridos (connector_id, task_ids, clusters_requested)", 400);
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

  const normalizedApproach = normalizeApproach(body.approach);
  const approaches = normalizedApproach ? [normalizedApproach] : ["predictive", "agile", "hybrid"];
  const diffMin = body.difficulty_min ?? 2;
  const diffMax = body.difficulty_max ?? 4;

  let clustersCreated = 0;
  let clustersFailed = 0;
  const errors: string[] = [];

  for (let c = 0; c < body.clusters_requested; c++) {
    const taskId = body.task_ids[c % body.task_ids.length];
    const approach = approaches[c % approaches.length];
    const questionsCount = body.questions_per_cluster ?? (3 + Math.floor(Math.random() * 3)); // 3-5
    const targetLetters = Array.from({ length: questionsCount }, (_, idx) => ["A", "B", "C", "D"][(c + idx) % 4]);
    const targetDifficulties = Array.from({ length: questionsCount }, () => Math.floor(Math.random() * (diffMax - diffMin + 1)) + diffMin);
    const targetProcessGroup = WEIGHTED_PROCESS_GROUPS[c % WEIGHTED_PROCESS_GROUPS.length];
    const targetPerformanceDomain = PERFORMANCE_DOMAINS[c % PERFORMANCE_DOMAINS.length];
    const targetThemes = pickThemes();

    const { data: task } = await admin
      .from("eco_tasks")
      .select("id, title, eco_domains(name), eco_enablers(description)")
      .eq("id", taskId)
      .single();
    if (!task) { clustersFailed++; errors.push(`Cluster ${c + 1}: tarea no encontrada`); continue; }

    try {
      const result = await callLlm(
        { provider: connectorRow.provider, model_id: connectorRow.model_id, api_base_url: connectorRow.api_base_url, apiKey },
        buildSystemPrompt(),
        buildUserPrompt(task, approach, questionsCount, targetLetters, targetDifficulties, targetProcessGroup, targetThemes, targetPerformanceDomain),
        5000, // un cluster completo (escenario + 3-5 preguntas con opciones+explicación) necesita mucho más espacio que una pregunta suelta (1200 por defecto truncaba el JSON a mitad)
      );

      const cleaned = result.text.replace(/```json|```/g, "").trim();
      let draft: any;
      try {
        draft = JSON.parse(cleaned);
      } catch {
        try {
          draft = JSON.parse(repairUnescapedQuotes(cleaned));
        } catch (parseErr) {
          clustersFailed++;
          errors.push(`Cluster ${c + 1}: JSON inválido (${(parseErr as Error).message}) — fragmento: ${cleaned.slice(0, 200)}`);
          continue;
        }
      }

      if (!draft.scenario_text || !Array.isArray(draft.questions) || draft.questions.length !== questionsCount) {
        clustersFailed++;
        errors.push(`Cluster ${c + 1}: estructura inválida (esperaba ${questionsCount} preguntas, llegaron ${draft.questions?.length ?? 0})`);
        continue;
      }

      const allIssues: string[] = [];
      draft.questions.forEach((q: any, idx: number) => {
        const issues = validateQuestion(q, targetLetters[idx], targetDifficulties[idx]);
        if (issues.length > 0) allIssues.push(`pregunta ${idx + 1}: ${issues.join("; ")}`);
        const fullText = `${q.stem ?? ""}\n${q.explanation ?? ""}`;
        for (const p of FORBIDDEN_PATTERNS) if (p.test(fullText)) allIssues.push(`pregunta ${idx + 1}: patrón no permitido`);
      });

      if (allIssues.length > 0) {
        clustersFailed++;
        errors.push(`Cluster ${c + 1}: ${allIssues.join(" | ")}`);
        continue;
      }

      const { data: cluster, error: clusterErr } = await admin
        .from("case_clusters")
        .insert({
          title: draft.scenario_title ?? `Caso ${c + 1}`,
          scenario_text: draft.scenario_text,
          status: "draft",
        })
        .select("id")
        .single();
      if (clusterErr || !cluster) {
        clustersFailed++;
        errors.push(`Cluster ${c + 1}: error al crear case_clusters (${clusterErr?.message})`);
        continue;
      }

      const rows = draft.questions.map((q: any, idx: number) => ({
        item_type: "case_child",
        format: "mc_single",
        cluster_id: cluster.id,
        stem: q.stem,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        task_id: taskId,
        approach,
        difficulty: targetDifficulties[idx],
        process_group: targetProcessGroup,
        performance_domain: targetPerformanceDomain,
        focus_tags: targetThemes,
        status: "draft",
      }));

      const { error: questionsErr } = await admin.from("questions").insert(rows);
      if (questionsErr) {
        clustersFailed++;
        errors.push(`Cluster ${c + 1}: error al insertar preguntas (${questionsErr.message})`);
        // Limpieza: si fallan las preguntas, no dejar un cluster huérfano sin hijos.
        await admin.from("case_clusters").delete().eq("id", cluster.id);
        continue;
      }

      clustersCreated++;
    } catch (err) {
      clustersFailed++;
      errors.push(`Cluster ${c + 1}: ${(err as Error).message}`);
    }
  }

  return jsonResponse({
    clusters_created: clustersCreated,
    clusters_failed: clustersFailed,
    errors: errors.slice(0, 20),
  });
});
