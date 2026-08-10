// Edge Function: generate_dashboard_tension_question
//
// POST -> genera preguntas tipo practicum de "dashboard con tensión entre dos
// métricas" (spec lote B, corpus oficial PMI, §7.5): un panel muestra una
// métrica mejorando mientras otra empeora simultáneamente (el ejemplo más
// común en el corpus real es sostenibilidad vs. velocidad/coste, pero el
// patrón es más general -- calidad vs. velocidad, moral del equipo vs.
// entrega, riesgo vs. ahorro, etc.). La pregunta obliga a resolver la tensión
// con una respuesta compuesta, nunca eligiendo un bando de forma unilateral.
//
// Patrón de las 4 opciones confirmado en 9 casos reales del PMI (§7.5),
// siempre con el mismo reparto de roles:
//   - "correct": visión equilibrada/holística, sopesa corto y largo plazo.
//   - "extreme": reacción extrema -- elimina/abandona por completo una de
//     las dos métricas para optimizar la otra.
//   - "passive": status quo -- sigue igual porque la métrica que mejora
//     "luce bien", ignorando la señal de alerta de la que empeora.
//   - "disproportionate": escala o formaliza en exceso (comité, pausa) algo
//     que se gestiona a nivel de proyecto.
//
// Mismo principio de seguridad que el resto de generadores deterministas
// (generate_earned_value_question, generate_network_diagram_question): la
// IA NUNCA construye los datos numéricos de las series ni el SVG -- solo
// aporta texto (escenario, nombres de las métricas, opciones) y un rango de
// valores; el código genera la serie con jitter real y dibuja el gráfico,
// y fija qué opción va en qué posición ANTES de llamar al modelo.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLlm } from "../_shared/llmProviders.ts";
import { tagRowsFor } from "../_shared/tagMapping.ts";
import { buildRejectionContext } from "../_shared/rejectionContext.ts";

interface CreateDashboardBody {
  connector_id: string;
  task_ids: string[];
  count_requested: number;
}

const PROCESS_GROUPS = ["initiation", "planning", "execution", "monitoring_control", "closing"] as const;
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
  // La tensión sostenibilidad-vs-velocidad es el ejemplo más común del corpus real,
  // así que aquí se sube la probabilidad respecto al resto de generadores (10% -> 35%).
  if (Math.random() < 0.35) themes.push("sostenibilidad");
  if (Math.random() < 0.1) themes.push("ia");
  return themes;
}
const THEME_INSTRUCTIONS: Record<string, string> = {
  entrega_valor: "El escenario debe integrar de forma natural el concepto de entrega basada en el valor.",
  sostenibilidad: "Una de las dos métricas del dashboard debería ser de sostenibilidad (ambiental, social o de largo plazo) si encaja de forma natural -- es el patrón más común en el examen oficial real.",
  ia: "El escenario debe integrar de forma natural el uso de inteligencia artificial como herramienta de apoyo.",
};

const OPTION_ROLES = ["correct", "extreme", "passive", "disproportionate"] as const;
type OptionRole = typeof OPTION_ROLES[number];
const ROLE_TO_ERROR_TYPE: Record<Exclude<OptionRole, "correct">, string> = {
  extreme: "analysis",
  passive: "reading",
  disproportionate: "time",
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildSystemPrompt(): string {
  return `Eres un redactor experto de exámenes de certificación de project management, familiarizado con el
Exam Content Outline (ECO) 2026 de PMI. NUNCA cites literalmente ni parafrasees de cerca el PMBOK u otro
material protegido.

Tu tarea es generar el contenido para una pregunta tipo "dashboard" -- un panel muestra DOS métricas del
proyecto evolucionando en direcciones opuestas al mismo tiempo (una mejora, otra empeora), y el candidato
debe resolver la tensión, NO elegir un bando. El patrón confirmado en preguntas oficiales reales del PMI:
la respuesta correcta NUNCA es abandonar una métrica por la otra, ni ignorar la señal de alerta, ni escalar
innecesariamente -- es una acción compuesta que analiza ambas tendencias y ajusta prioridades sin sacrificar
ninguna por completo.

Debes aportar SOLO texto y rangos numéricos -- el gráfico real y los valores exactos de cada punto los
construye el código, tú nunca dibujas el gráfico ni inventas la serie completa.

Genera EXACTAMENTE 4 opciones, cada una con un "role" de estos 4 (uno de cada, sin repetir):
- "correct": visión equilibrada/holística que sopesa corto y largo plazo, analiza ambas tendencias y ajusta
  prioridades -- nunca es una acción única y drástica, tiende a combinar verbos ("analizar X y ajustar Y").
- "extreme": reacción extrema -- abandona o elimina por completo una de las dos métricas para optimizar
  solo la otra.
- "passive": status quo/pasivo -- seguir igual porque la métrica que mejora "luce bien", ignorando la señal
  de alerta de la métrica que empeora.
- "disproportionate": escalar a un comité o pausar el proyecto de forma innecesaria para algo que se
  gestiona perfectamente a nivel de proyecto.

TERMINOLOGÍA (obligatorio): esto se rige por PMBOK 8 (publicado ene 2026), NO por PMBOK 6/7. NUNCA nombres
un proceso concreto al estilo PMBOK 6 ni uses "áreas de conocimiento" o "triple restricción".

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
{
  "stem": "Escenario situacional que termina pidiendo la mejor acción ante el dashboard descrito",
  "metric_a": {"name": "nombre corto de la métrica que MEJORA", "unit": "unidad corta (ej. puntos, %, defectos)", "start_value": <número>, "end_value": <número>},
  "metric_b": {"name": "nombre corto de la métrica que EMPEORA", "unit": "unidad corta", "start_value": <número>, "end_value": <número>},
  "options": [
    {"role": "correct", "text": "..."},
    {"role": "extreme", "text": "..."},
    {"role": "passive", "text": "..."},
    {"role": "disproportionate", "text": "..."}
  ],
  "explanation": "Por qué la opción correcta resuelve la tensión, y por qué cada una de las otras 3 falla, conectándolo con su rol (extrema/pasiva/desproporcionada)"
}`;
}

function buildUserPrompt(task: any, targetThemes: Theme[], targetProcessGroup: string, targetPerformanceDomain: string, rejectionContext: string): string {
  const enablers = (task.eco_enablers ?? []).map((e: any) => `- ${e.description}`).join("\n");
  const themeLine = targetThemes.length > 0
    ? `\n\nTEMÁTICA(S) (obligatorio, todas): ${targetThemes.map((t) => THEME_INSTRUCTIONS[t]).join(" ")}`
    : "";
  return `Dominio ECO: ${task.eco_domains.name}
Tarea: ${task.title}
Enablers de referencia:
${enablers}${themeLine}

GRUPO DE PROCESO / ÁREA DE ENFOQUE (obligatorio): el escenario debe situarse claramente en la etapa de
"${PROCESS_GROUP_LABELS[targetProcessGroup]}" del ciclo de vida del proyecto.

DOMINIO DE DESEMPEÑO (obligatorio): la pregunta debe girar principalmente en torno a
"${PERFORMANCE_DOMAIN_LABELS[targetPerformanceDomain]}" (etiqueta independiente de la tarea ECO indicada).

Genera un escenario situacional en español (neutro, España/LATAM) relacionado con esta tarea donde el
candidato observa un dashboard con dos métricas en tensión (una mejora, otra empeora) y debe decidir la
mejor acción.${rejectionContext}`;
}

interface Metric { name: string; unit: string; start_value: number; end_value: number }

function buildDashboardSvg(periods: number, metricA: Metric, seriesA: number[], metricB: Metric, seriesB: number[]): string {
  const W = 480, panelH = 130, gap = 30, padL = 50, padR = 20, padT = 25, padB = 25;
  const chartW = W - padL - padR;

  function panelSvg(metric: Metric, series: number[], yOffset: number, color: string): string {
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const chartH = panelH - padT - padB;
    const stepX = chartW / (periods - 1);
    const points = series.map((v, i) => {
      const x = padL + i * stepX;
      const y = yOffset + padT + chartH - ((v - min) / range) * chartH;
      return { x, y, v };
    });
    const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
    const dots = points.map((p, i) =>
      `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color}"/>` +
      `<text x="${p.x}" y="${p.y - 8}" font-size="10" text-anchor="middle" fill="#374151">${p.v}${metric.unit}</text>` +
      `<text x="${p.x}" y="${yOffset + panelH - 4}" font-size="9" text-anchor="middle" fill="#6b7280">P${i + 1}</text>`
    ).join("");
    return `
      <text x="${padL}" y="${yOffset + 14}" font-size="12" font-weight="bold" fill="#111827">${metric.name}</text>
      <line x1="${padL}" y1="${yOffset + padT}" x2="${padL}" y2="${yOffset + panelH - padB}" stroke="#d1d5db"/>
      <line x1="${padL}" y1="${yOffset + panelH - padB}" x2="${padL + chartW}" y2="${yOffset + panelH - padB}" stroke="#d1d5db"/>
      <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2"/>
      ${dots}`;
  }

  const panelA = panelSvg(metricA, seriesA, 0, "#2563eb");
  const panelB = panelSvg(metricB, seriesB, panelH + gap, "#dc2626");
  const totalH = panelH * 2 + gap;
  return `<svg viewBox="0 0 ${W} ${totalH}" xmlns="http://www.w3.org/2000/svg">${panelA}${panelB}</svg>`;
}

function buildSeries(periods: number, start: number, end: number, jitterPct: number): number[] {
  const series: number[] = [];
  for (let i = 0; i < periods; i++) {
    const t = i / (periods - 1);
    const base = start + (end - start) * t;
    const jitter = i === 0 || i === periods - 1 ? 0 : (Math.random() * 2 - 1) * Math.abs(end - start) * jitterPct;
    series.push(Math.round((base + jitter) * 10) / 10);
  }
  series[0] = start;
  series[periods - 1] = end;
  return series;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();
  const body: CreateDashboardBody = await req.json();
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
    const targetProcessGroup = WEIGHTED_PROCESS_GROUPS[i % WEIGHTED_PROCESS_GROUPS.length];
    const targetPerformanceDomain = PERFORMANCE_DOMAINS[i % PERFORMANCE_DOMAINS.length];
    const targetThemes = pickThemes();

    const { data: task } = await admin
      .from("eco_tasks")
      .select("id, title, eco_domains(name, code), eco_enablers(description)")
      .eq("id", taskId)
      .single();
    if (!task) { failed++; errors.push(`Ítem ${i + 1}: tarea no encontrada`); continue; }

    try {
      const rejectionContext = await buildRejectionContext(admin, taskId);
      const result = await callLlm(
        { provider: connectorRow.provider, model_id: connectorRow.model_id, api_base_url: connectorRow.api_base_url, apiKey },
        buildSystemPrompt(),
        buildUserPrompt(task, targetThemes, targetProcessGroup, targetPerformanceDomain, rejectionContext),
        1500,
      );

      const cleaned = result.text.replace(/```json|```/g, "").trim();
      let draft: any;
      try {
        draft = JSON.parse(cleaned);
      } catch (parseErr) {
        failed++;
        errors.push(`Ítem ${i + 1}: JSON inválido (${(parseErr as Error).message})`);
        continue;
      }

      // Validación estructural: 4 opciones, exactamente 1 de cada rol, y tensión
      // numérica real (las 2 métricas deben moverse en sentidos porcentuales
      // opuestos -- si no, no hay tensión genuina que resolver).
      const roles: OptionRole[] = (draft.options ?? []).map((o: any) => o.role);
      const hasAllRoles = OPTION_ROLES.every((r) => roles.filter((x) => x === r).length === 1);
      if (!draft.stem || !draft.metric_a || !draft.metric_b || !Array.isArray(draft.options) || draft.options.length !== 4 || !hasAllRoles || !draft.explanation) {
        failed++;
        errors.push(`Ítem ${i + 1}: estructura inválida (roles recibidos: ${roles.join(",")})`);
        continue;
      }

      const metricA: Metric = draft.metric_a;
      const metricB: Metric = draft.metric_b;
      const pctChangeA = (metricA.end_value - metricA.start_value) / (Math.abs(metricA.start_value) || 1);
      const pctChangeB = (metricB.end_value - metricB.start_value) / (Math.abs(metricB.start_value) || 1);
      if (Math.sign(pctChangeA) === Math.sign(pctChangeB) || Math.abs(pctChangeA) < 0.05 || Math.abs(pctChangeB) < 0.05) {
        failed++;
        errors.push(`Ítem ${i + 1}: sin tensión numérica real entre las 2 métricas (deben moverse en sentidos opuestos)`);
        continue;
      }

      // Posición de la respuesta correcta: se decide AQUÍ, por código, tras validar
      // los roles -- nunca se confía en que el modelo la ponga en una letra concreta,
      // se baraja después de recibir el contenido (mismo principio que el resto de
      // generadores, solo que aquí la posición se fija DESPUÉS porque el rol, no la
      // letra, es lo que se le pide al modelo).
      const letters = ["A", "B", "C", "D"];
      for (let k = letters.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [letters[k], letters[j]] = [letters[j], letters[k]];
      }
      const optionsByRole = new Map<OptionRole, any>(draft.options.map((o: any) => [o.role as OptionRole, o]));
      const options = OPTION_ROLES.map((role, idx) => ({
        id: letters[idx],
        text: optionsByRole.get(role).text,
        ...(role !== "correct" ? { error_type: ROLE_TO_ERROR_TYPE[role] } : {}),
      }));
      const correctLetter = letters[OPTION_ROLES.indexOf("correct")];

      const periods = randInt(5, 6);
      const seriesA = buildSeries(periods, metricA.start_value, metricA.end_value, 0.08);
      const seriesB = buildSeries(periods, metricB.start_value, metricB.end_value, 0.08);
      const diagramSvg = buildDashboardSvg(periods, metricA, seriesA, metricB, seriesB);

      const difficulty = randInt(3, 4);

      const { data: insertedQuestion } = await admin.from("questions").insert({
        item_type: "standalone",
        format: "graphic_based",
        stem: draft.stem,
        options,
        correct_answer: [correctLetter],
        explanation: draft.explanation,
        task_id: taskId,
        approach: "hybrid", // resolver tensión entre 2 métricas es inherentemente un juicio híbrido/ágil
        difficulty,
        process_group: targetProcessGroup,
        performance_domain: targetPerformanceDomain,
        focus_tags: targetThemes,
        status: "draft",
        practicum_payload: {
          chart_type: "dashboard_tension",
          diagram_svg: diagramSvg,
          metric_a: { ...metricA, series: seriesA },
          metric_b: { ...metricB, series: seriesB },
        },
      }).select("id").single();

      if (insertedQuestion) {
        await admin.from("question_tags").insert(tagRowsFor(insertedQuestion.id, {
          domainCode: task.eco_domains.code,
          approach: "hybrid",
          processGroup: targetProcessGroup,
          performanceDomain: targetPerformanceDomain,
          themes: targetThemes,
          isCase: false,
          format: "graphic_based",
        }));
      }
      generated++;
    } catch (err) {
      failed++;
      errors.push(`Ítem ${i + 1}: ${(err as Error).message}`);
    }
  }

  return jsonResponse({ generated, failed, errors: errors.slice(0, 20) });
});
