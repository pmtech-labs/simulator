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
import { tagRowsFor } from "../_shared/tagMapping.ts";
import { buildRejectionContext } from "../_shared/rejectionContext.ts";
import { pickStyleExamples } from "../_shared/fewShotExamples.ts";
import { terminologiaObligatoria } from "../_shared/terminologyDictionary.ts";

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

FORMATO DE TEXTO (crítico, causa de errores si se ignora): dentro de "stem", "options[].text" y
"explanation" NUNCA uses comillas dobles ("). Si necesitas citar literalmente lo que dice un
interesado o un documento, usa comillas simples (') o comillas angulares (« »). Las comillas dobles
sin escapar dentro del texto rompen el JSON de salida — evítalas por completo, no las escapes con \\".

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
- "wrong_document": la opción invoca un artefacto/documento real del proyecto, pero NO el que gobierna
  esta situación concreta (ej. consultar el registro de riesgos cuando lo que corresponde es el plan de
  gestión de cambios).
- "unsupervised_delegation": la opción deja que un tercero (proveedor, IA/ML, o un solo miembro del
  equipo) tome o ejecute la decisión sin validación humana ni supervisión -- patrón especialmente
  relevante en preguntas sobre IA: la opción correcta NUNCA es "adoptar/aplicar el resultado de la IA
  sin más", exige análisis conjunto con el equipo o validación humana antes de actuar sobre él.
Asigna un "error_type" (uno de estos 10 valores exactos) a CADA opción incorrecta. La opción correcta no
lleva error_type.

TERMINOLOGÍA (obligatorio): esta pregunta se rige por PMBOK 8 (publicado ene 2026), NO por PMBOK 6/7.
NUNCA nombres un proceso concreto al estilo PMBOK 6 (ej. "Desarrollar el Cronograma", "Recopilar
Requisitos") ni uses "áreas de conocimiento" o "triple restricción" como términos -- PMBOK 8 organiza
el contenido en 7 dominios de desempeño (Gobernanza, Alcance, Cronograma, Finanzas, Interesados,
Recursos, Riesgo) y 6 principios, sin una lista cerrada de 49 procesos con nombre. EXCEPCIÓN
confirmada por la clave de respuestas real: "Realizar el control integrado de cambios" SÍ es
vocabulario vivo del examen 2026 (14 apariciones en las 180 preguntas oficiales, forma heredada que
el examen retiene aunque PMBOK 8 renombró la técnica) -- úsalo con normalidad cuando el contexto sea
control de cambios, no lo trates como un proceso PMBOK 6 prohibido.

ESTILO DE LA RESPUESTA CORRECTA (verificado contra la clave real de 152 preguntas oficiales del PMI con
respuesta confirmada, agosto 2026 -- NO uses esto como regla mecánica): el patrón de "verbo analítico +
acción" (analizar/evaluar/revisar/reunirse/consultar + acción resultante) aparece en la correcta en
aproximadamente el 40% de los casos reales -- es una tendencia real pero MINORITARIA, no la norma. El rasgo
que sí es consistente en casi todas las correctas es más amplio: una acción medida y profesional (nunca
drástica, nunca precipitada, nunca delega sin supervisión), que puede estar redactada como verbo compuesto
("analizar el impacto y ajustar...") o como un único verbo igualmente medido ("perfeccionar la lista de
trabajo pendiente", "facilitar un debate estructurado"). NO fuerces el patrón de verbo compuesto en cada
pregunta -- varía la redacción libremente, y evita que la única opción con verbo compuesto sea siempre la
correcta, porque eso vuelve la pregunta adivinable por estilo de redacción en vez de por juicio profesional
real.

TEMAS A CONSIDERAR SI ENCAJAN CON LA TAREA (confirmados en el examen oficial real, no forzar en toda
pregunta): gobernanza de decisiones con IA (validar el resultado con juicio humano, nunca adoptarlo sin
más), institucionalización de lecciones aprendidas más allá del proyecto individual, juicio sobre cuándo
NO escalar aunque haya presión de un interesado sénior, integridad y transparencia de los datos de reporte,
adaptar la comunicación a audiencias con intereses divergentes sin perder coherencia, realización de
beneficios post-entrega (no solo cumplir el cronograma).

CALIDAD DE LA EXPLICACIÓN (obligatoria): la explicación debe, en un solo texto fluido:
1. Indicar cuál es la mejor respuesta y qué dato del enunciado resulta decisivo para elegirla.
2. Explicar el razonamiento que conduce a la solución (qué principio profesional se evalúa).
3. Explicar por qué CADA una de las demás opciones es menos adecuada, conectándolo con su error_type
   (ej. "es una acción válida pero prematura" para sequence, "correspondería al patrocinador" para role).
${terminologiaObligatoria()}

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks, con esta forma exacta:
{"stem":"...","options":[{"id":"A","text":"...","error_type":"sequence"},{"id":"B","text":"..."},{"id":"C","text":"...","error_type":"role"},{"id":"D","text":"...","error_type":"analysis"}],"correct_answer":["B"],"explanation":"...","difficulty":<entero 1-5 según se te indique, NUNCA un valor fijo por defecto>}

Recuerda: responde SOLO el JSON, nada de texto antes o después, aunque el bloque de arriba sea largo.`;
}

function buildUserPrompt(task: any, approach: string, format: string, targetDifficulty: number, focusTags: string[], targetLetter: string, targetProcessGroup: string, targetThemes: Theme[], targetPerformanceDomain: string, targetMultiLetters: string[] | null, rejectionContext: string) {
  const enablers = (task.eco_enablers ?? []).map((e: any) => `- ${e.description}`).join("\n");
  const focusLine = focusTags.length > 0 ? `\nTemas transversales a entretejer si es natural: ${focusTags.join(", ")}` : "";
  const themeLine = targetThemes.length > 0
    ? `\n\nTEMÁTICA(S) (obligatorio, todas las indicadas): ${targetThemes.map((t) => THEME_INSTRUCTIONS[t]).join(" ")}`
    : "";
  // Requisito del PO + confirmado con clave real del lote B (feedback de 180
  // preguntas oficiales, ago 2026): mc_multi NO es siempre "elige 2" -- el corpus
  // real tiene N=2 en 15/23 casos y N=3 en 8/23 (Q161 es N=3: "Seleccione 3
  // opciones"). Generalizado para aceptar cualquier N, siempre sobre 5 opciones.
  const answerPositionBlock = targetMultiLetters
    ? `POSICIÓN DE LAS RESPUESTAS CORRECTAS (obligatorio, no lo cambies): debes generar EXACTAMENTE 5
opciones (A, B, C, D, E). Las opciones correctas deben ser EXACTAMENTE ${targetMultiLetters.map((l) => `"${l}"`).join(", ")}
-- es decir, "correct_answer" debe ser exactamente [${targetMultiLetters.map((l) => `"${l}"`).join(", ")}].
Las otras ${5 - targetMultiLetters.length} opciones son distractores individuales, cada uno incorrecto por
sí solo aunque pueda parecer razonable. Esta pregunta solo se considera acertada si el candidato marca
EXACTAMENTE esas ${targetMultiLetters.length} opciones, ninguna más y ninguna menos -- constrúyela así
desde el principio. El enunciado debe usar exactamente esta fórmula según N (confirmado con la clave real
del lote B, §10.2 del spec de terminología): si N=${targetMultiLetters.length} es 3, usa "Seleccione todas
las opciones que correspondan" (patrón confirmado: en el corpus oficial, el formato abierto "todas las que
correspondan" tiene SIEMPRE 3 correctas de 5, nunca 2 ni 4); si N=${targetMultiLetters.length} es 2, usa la
forma cerrada "Seleccione 2 opciones".`
    : `POSICIÓN DE LA RESPUESTA CORRECTA (obligatorio, no lo cambies): la opción correcta debe quedar en la
posición "${targetLetter}". Es decir, "correct_answer" debe ser exactamente ["${targetLetter}"], y el
resto de posiciones (A, B, C, D excluyendo "${targetLetter}") deben ser los distractores. Construye tu
razonamiento y el orden de las opciones directamente para que esto sea cierto desde el principio —
no generes la pregunta con la correcta en otra posición y la corrijas después.`;
  return `Dominio ECO: ${task.eco_domains.name}
Tarea: ${task.title}
Enablers de referencia:
${enablers}

Enfoque de gestión de proyectos: ${approach}
Formato: ${format}${focusLine}${themeLine}

Genera UNA pregunta de examen tipo PMP en español (neutro, España/LATAM), situacional, evaluando esta tarea.

${answerPositionBlock}

DIFICULTAD (obligatorio, no lo cambies): el campo "difficulty" de tu respuesta debe ser exactamente el
número ${targetDifficulty} (escala 1-5, donde 1 es muy fácil y 5 es muy difícil). Construye el enunciado,
la longitud, la ambigüedad de las opciones y la complejidad del razonamiento requerido para que
correspondan de verdad a ese nivel de dificultad — no pongas siempre un valor intermedio por defecto.

GRUPO DE PROCESO / ÁREA DE ENFOQUE (obligatorio): el escenario debe situarse claramente en la etapa de
"${PROCESS_GROUP_LABELS[targetProcessGroup]}" del ciclo de vida del proyecto (Inicio, Planificación,
Ejecución, Monitoreo y Control, o Cierre). Deja claro en el propio enunciado en qué momento del proyecto
ocurre la situación, para que sea reconocible sin ambigüedad.

DOMINIO DE DESEMPEÑO (obligatorio, no lo cambies): la pregunta debe girar principalmente en torno a
"${PERFORMANCE_DOMAIN_LABELS[targetPerformanceDomain]}". Esta etiqueta es independiente de la tarea ECO
indicada arriba — no hace falta que coincidan; solo asegúrate de que el contenido real de la pregunta
(la decisión que debe tomar el candidato) esté genuinamente relacionado con "${PERFORMANCE_DOMAIN_LABELS[targetPerformanceDomain]}".${rejectionContext}${pickStyleExamples(2)}`;
}

const VALID_ERROR_TYPES = ["knowledge", "interpretation", "sequence", "role", "approach", "reading", "analysis", "time", "wrong_document", "unsupervised_delegation"];

// Requisito del PO: "Áreas de Enfoque" (grupos de proceso clásicos), objetivo 20% cada
// uno en el simulacro completo.
const PROCESS_GROUPS = ["initiation", "planning", "execution", "monitoring_control", "closing"] as const;
// Actualización del PO: Áreas de Enfoque pasan de 20/20/20/20/20 a 10/30/20/30/10.
// Rotación ponderada (10 slots) en vez de simple i%5, para garantizar la proporción
// exacta en cualquier lote múltiplo de 10 y aproximarla bien en lotes más pequeños.
const WEIGHTED_PROCESS_GROUPS = [
  "initiation",
  "planning", "planning", "planning",
  "execution", "execution",
  "monitoring_control", "monitoring_control", "monitoring_control",
  "closing",
] as const;
const PROCESS_GROUP_LABELS: Record<string, string> = {
  initiation: "Inicio",
  planning: "Planificación",
  execution: "Ejecución",
  monitoring_control: "Monitoreo y Control",
  closing: "Cierre",
};

// Requisito del PO: "Dominios de Desempeño", etiqueta INDEPENDIENTE de la tarea ECO
// (aclarado explícitamente por el PO: no se empareja con las 26 tareas, ningún
// simulador lo hace -- se decide directamente por el contenido de la pregunta).
const PERFORMANCE_DOMAINS = ["gobernanza", "alcance", "cronograma", "finanzas", "recursos", "riesgos", "interesados"] as const;
const PERFORMANCE_DOMAIN_LABELS: Record<string, string> = {
  gobernanza: "Gobernanza",
  alcance: "Alcance",
  cronograma: "Cronograma",
  finanzas: "Finanzas",
  recursos: "Recursos",
  riesgos: "Riesgos",
  interesados: "Interesados",
};

// Requisito del PO: "Nuevas Temáticas", NO son excluyentes entre sí (una pregunta
// puede llevar varias a la vez) -- se decide cada una con una tirada independiente:
// 50% probabilidad de entrega de valor, 10% sostenibilidad, 10% IA. Si ninguna sale,
// la pregunta queda sin temática añadida (~30% resultante, sin ser un tope estricto).
type Theme = "entrega_valor" | "sostenibilidad" | "ia";
function pickThemes(): Theme[] {
  const themes: Theme[] = [];
  if (Math.random() < 0.5) themes.push("entrega_valor");
  if (Math.random() < 0.1) themes.push("sostenibilidad");
  if (Math.random() < 0.1) themes.push("ia");
  return themes;
}
const THEME_INSTRUCTIONS: Record<string, string> = {
  entrega_valor: "El escenario debe integrar de forma natural el concepto de entrega basada en el valor (priorizar, medir o comunicar el valor real que el proyecto aporta al negocio o al cliente).",
  sostenibilidad: "El escenario debe integrar de forma natural una consideración de sostenibilidad (impacto ambiental, social o de largo plazo de las decisiones del proyecto).",
  ia: "El escenario debe integrar de forma natural el uso de inteligencia artificial como herramienta de apoyo en la gestión del proyecto (no como tema central de la pregunta, sino como parte realista del contexto).",
};

// Reparación de emergencia: el modelo a veces cuela comillas dobles literales dentro
// del texto (stem/explanation) pese a la instrucción del prompt, lo que rompe el JSON
// ("Expected ':' after property name"). Recorre el texto carácter a carácter y, cuando
// encuentra una comilla que abre una cadena de texto y la siguiente comilla NO va seguida
// de un carácter estructural de JSON (: , } ]), la trata como comilla literal de contenido
// y la escapa, en vez de cerrarla.
function repairUnescapedQuotes(text: string): string {
  let result = "";
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      result += ch;
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        const next = text[j];
        if (next === ":" || next === "," || next === "}" || next === "]" || j >= text.length) {
          inString = false;
          result += ch;
        } else {
          result += '\\"';
        }
      }
      continue;
    }
    result += ch;
  }
  return result;
}

function validateDraft(draft: any, targetLetter: string, targetDifficulty: number, targetMultiLetters: string[] | null): string[] {
  const issues: string[] = [];
  if (!draft.stem || draft.stem.length < 20) issues.push("Enunciado demasiado corto");
  if (!Array.isArray(draft.options) || draft.options.length < 2) issues.push("Menos de 2 opciones");
  if (targetMultiLetters) {
    // Confirmado con clave real del lote B: mc_multi exige EXACTAMENTE 5 opciones y
    // EXACTAMENTE N correctas (N=2 o N=3 según lo pedido) -- ni más ni menos.
    if (!Array.isArray(draft.options) || draft.options.length !== 5) {
      issues.push(`mc_multi debe tener exactamente 5 opciones (llegaron ${draft.options?.length ?? 0})`);
    }
    if (!Array.isArray(draft.correct_answer) || draft.correct_answer.length !== targetMultiLetters.length) {
      issues.push(`mc_multi debe tener exactamente ${targetMultiLetters.length} respuestas correctas (llegaron ${draft.correct_answer?.length ?? 0})`);
    } else {
      const got = [...draft.correct_answer].sort();
      const want = [...targetMultiLetters].sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        issues.push(`Las respuestas correctas de mc_multi no coinciden con las solicitadas (pedidas: ${want.join(",")}, recibidas: ${got.join(",")})`);
      }
    }
  }
  if (!Array.isArray(draft.correct_answer) || draft.correct_answer.length === 0) {
    issues.push("correct_answer vacío");
  } else if (Array.isArray(draft.options)) {
    const ids = new Set(draft.options.map((o: any) => o.id));
    if (!draft.correct_answer.every((id: string) => ids.has(id))) {
      issues.push("correct_answer no coincide con options");
    }
    // La posición de la correcta se fija ANTES de generar (ver buildUserPrompt) para que
    // el propio modelo escriba explanation/options ya coherentes con esa letra desde el
    // origen. Aquí solo se verifica que el modelo cumplió lo pedido; si no, se descarta
    // el ítem en vez de reordenar después (reordenar rompía las referencias a letras
    // dentro del texto libre de "explanation", que el modelo sí escribe en prosa).
    if (!targetMultiLetters && !draft.correct_answer.includes(targetLetter)) {
      issues.push(`La respuesta correcta no quedó en la posición solicitada (${targetLetter})`);
    }
    for (const opt of draft.options) {
      if (!opt.text || String(opt.text).trim().length < 3) {
        issues.push(`Opción ${opt.id} sin texto (posible corrupción de JSON)`);
      }
      const isCorrectOption = draft.correct_answer?.includes(opt.id);
      if (!isCorrectOption) {
        if (!opt.error_type) issues.push(`Opción ${opt.id} (distractor) sin error_type`);
        else if (!VALID_ERROR_TYPES.includes(opt.error_type)) issues.push(`Opción ${opt.id} con error_type inválido: ${opt.error_type}`);
      }
    }
  }
  if (!draft.explanation || draft.explanation.length < 20) issues.push("Explicación ausente o corta");
  if (Number(draft.difficulty) !== targetDifficulty) {
    issues.push(`La dificultad devuelta (${draft.difficulty}) no coincide con la solicitada (${targetDifficulty})`);
  }
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
      // generation_jobs.format es un enum (item_format, el mismo que usa questions.format,
      // donde "mixed" no tendría sentido para una pregunta individual) -- no admite el
      // valor "mixed" literal. Cuando se pide mezcla, se guarda "mc_single" aquí solo como
      // valor representativo de seguimiento del job; el formato REAL de cada pregunta
      // generada (rotado de verdad) se guarda correctamente en questions.format.
      format: body.format === "mixed" ? "mc_single" : (body.format ?? "mc_single"),
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
  // "Mezcla automática" de formato: SOLO entre los formatos que este pipeline de IA
  // sabe generar de forma fiable (mc_single, mc_multi, pulldown) -- matching, hotspot
  // y graphic_based tienen sus propias Edge Functions dedicadas con construcción de
  // payload por código (admin_generate_matching_question, admin_generate_hotspot_question,
  // generate_network_diagram_question, generate_earned_value_question), y enhanced_matching
  // sigue siendo autoría manual por plantillas -- mezclarlos aquí generaría contenido
  // con la forma equivocada.
  const MIXED_FORMATS = ["mc_single", "mc_multi", "pulldown"];
  const formats = body.format === "mixed" ? MIXED_FORMATS : [body.format ?? "mc_single"];
  let generated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < body.count_requested; i++) {
    const taskId = body.task_ids[i % body.task_ids.length];
    const approach = approaches[i % approaches.length];
    const format = formats[i % formats.length];
    // Rota A/B/C/D determinísticamente por ítem para garantizar una distribución real
    // de la posición de la respuesta correcta a lo largo del lote (ver bug histórico:
    // el modelo copiaba literalmente el "B" del ejemplo del prompt casi siempre).
    const targetLetter = ["A", "B", "C", "D"][i % 4];
    // Confirmado con clave real del lote B (feedback de 180 preguntas oficiales):
    // mc_multi NO es siempre "elige 2" -- el corpus real tiene N=2 en 15/23 casos
    // (≈65%) y N=3 en 8/23 (≈35%), nunca más de 3. Se elige N con esa proporción real,
    // y luego se rota entre TODAS las combinaciones posibles de N sobre 5 opciones
    // (10 combinaciones para N=2, otras 10 para N=3) para variar la posición.
    const MC_MULTI_PAIRS = [
      ["A", "B"], ["A", "C"], ["A", "D"], ["A", "E"], ["B", "C"],
      ["B", "D"], ["B", "E"], ["C", "D"], ["C", "E"], ["D", "E"],
    ];
    const MC_MULTI_TRIPLES = [
      ["A", "B", "C"], ["A", "B", "D"], ["A", "B", "E"], ["A", "C", "D"], ["A", "C", "E"],
      ["A", "D", "E"], ["B", "C", "D"], ["B", "C", "E"], ["B", "D", "E"], ["C", "D", "E"],
    ];
    const useTriple = Math.random() < 0.35;
    const targetMultiLetters = format === "mc_multi"
      ? (useTriple ? MC_MULTI_TRIPLES[i % MC_MULTI_TRIPLES.length] : MC_MULTI_PAIRS[i % MC_MULTI_PAIRS.length])
      : null;
    // Dificultad objetivo aleatoria dentro del rango pedido, fijada ANTES de generar
    // (mismo motivo que targetLetter: el modelo copiaba literalmente el "3" de ejemplo
    // del prompt en vez de variar la dificultad — confirmado con datos reales: 44/44
    // preguntas generadas antes de este fix tenían difficulty=3 sin excepción).
    const diffMin = body.difficulty_min ?? 1;
    const diffMax = body.difficulty_max ?? 5;
    const targetDifficulty = Math.floor(Math.random() * (diffMax - diffMin + 1)) + diffMin;

    // Área de enfoque (grupo de proceso): rotación determinista para garantizar el
    // 20% exacto de cada uno en el lote, en vez de fiarse de que el modelo lo varíe.
    const targetProcessGroup = WEIGHTED_PROCESS_GROUPS[i % WEIGHTED_PROCESS_GROUPS.length];

    // Dominio de desempeño: rotación determinista (~14-15% cada uno de los 7),
    // etiqueta independiente de la tarea ECO (aclarado por el PO).
    const targetPerformanceDomain = PERFORMANCE_DOMAINS[i % PERFORMANCE_DOMAINS.length];

    // Nueva temática (requisito del PO): distribución ponderada 50% entrega de valor /
    // 10% sostenibilidad / 10% IA / 30% ninguna. Se decide ANTES de generar y se le
    // pide al modelo que integre el tema de forma natural en el escenario -- el tag
    // final se fija por código, no se confía en que el modelo lo autodeclare.
    const targetThemes = pickThemes();

    const { data: task } = await admin
      .from("eco_tasks")
      .select("id, title, eco_domains(name, code), eco_enablers(description)")
      .eq("id", taskId)
      .single();

    if (!task) { failed++; errors.push(`Tarea ${taskId} no encontrada`); continue; }

    try {
      const rejectionContext = await buildRejectionContext(admin, taskId);
      const result = await callLlm(
        { provider: connectorRow.provider, model_id: connectorRow.model_id, api_base_url: connectorRow.api_base_url, apiKey },
        buildSystemPrompt(),
        buildUserPrompt(task, approach, format, targetDifficulty, body.focus_tags ?? [], targetLetter, targetProcessGroup, targetThemes, targetPerformanceDomain, targetMultiLetters, rejectionContext),
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
          // Se incluye un fragmento del texto crudo devuelto por el modelo para poder
          // diagnosticar la causa real (comillas sin escapar, formato inesperado, etc.)
          // en vez de solo ver "JSON inválido" sin contexto.
          errors.push(
            `Ítem ${i + 1}: JSON inválido incluso tras reparación (${(parseErr as Error).message}) — fragmento crudo: ${cleaned.slice(0, 300)}`,
          );
          if (generated === 0 && failed >= 2) {
            errors.push(`Lote detenido tras ${failed} fallos consecutivos: revisa el modelo/clave del conector antes de reintentar.`);
            break;
          }
          continue;
        }
      }

      const issues = validateDraft(draft, targetLetter, targetDifficulty, targetMultiLetters);

      if (issues.length > 0) {
        failed++;
        errors.push(`Ítem ${i + 1}: ${issues.join("; ")}`);
        continue;
      }

      const { data: insertedQuestion } = await admin.from("questions").insert({
        item_type: "standalone",
        format,
        stem: draft.stem,
        options: draft.options,
        correct_answer: draft.correct_answer,
        explanation: draft.explanation,
        task_id: taskId,
        approach,
        difficulty: targetDifficulty,
        process_group: targetProcessGroup,
        performance_domain: targetPerformanceDomain,
        focus_tags: [...(body.focus_tags ?? []), ...targetThemes],
        status: "draft", // nunca se publica automáticamente
        generation_job_id: job.id,
      }).select("id").single();

      // Nueva taxonomía del PO (question_tags): DO/CI/AE/DD/FO/NT derivados de los
      // mismos valores ya fijados arriba, ninguna llamada extra a IA.
      if (insertedQuestion) {
        await admin.from("question_tags").insert(tagRowsFor(insertedQuestion.id, {
          domainCode: task.eco_domains.code,
          approach,
          processGroup: targetProcessGroup,
          performanceDomain: targetPerformanceDomain,
          themes: targetThemes,
          isCase: false,
          format,
        }));
      }
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
