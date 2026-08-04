// Edge Function: generate_earned_value_question
//
// POST -> genera preguntas de interpretación de valor ganado (EVM) de forma determinista.
// Mismo principio que generate_network_diagram_question: la serie PV/EV/AC y la
// clasificación del resultado (adelantado/retrasado en cronograma, por encima/por debajo
// de presupuesto) se calculan por código, nunca por un LLM -- SV=EV-PV y CV=EV-AC son
// aritmética simple, pero un LLM generando "datos realistas" a mano puede fácilmente
// producir una serie que no cuadre con la interpretación que luego describe como correcta.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { tagRowsFor } from "../_shared/tagMapping.ts";

const PROJECT_CONTEXTS = [
  "un proyecto de construcción de una nave industrial",
  "un proyecto de implementación de un ERP",
  "un proyecto de renovación de flota de vehículos",
  "un proyecto de desarrollo de un nuevo producto",
  "un proyecto de migración de infraestructura a la nube",
  "un proyecto de expansión de una cadena de tiendas",
];

type ScheduleStatus = "ahead" | "behind";
type CostStatus = "under" | "over";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildSeries(periods: number, finalValue: number, jitter: number): number[] {
  const series: number[] = [];
  for (let i = 1; i <= periods; i++) {
    const base = (finalValue * i) / periods;
    const noise = i === periods ? 0 : randInt(-jitter, jitter);
    series.push(Math.max(1, Math.round(base + noise)));
  }
  series[periods - 1] = finalValue; // el último valor es siempre el exacto, sin ruido
  return series;
}

interface GeneratedQuestion {
  stem: string;
  options: { id: string; text: string; error_type?: string }[];
  correct_answer: string[];
  explanation: string;
  difficulty: number;
  practicum_payload: { chart_type: string; evChart: { labels: string[]; pv: number[]; ev: number[]; ac: number[] } };
}

const SCENARIO_TEXT: Record<`${ScheduleStatus}_${CostStatus}`, string> = {
  ahead_under: "El proyecto está adelantado en cronograma (EV por encima de PV) y por debajo de presupuesto (AC por debajo de EV): ahorro de coste además de ir adelantado.",
  behind_over: "El proyecto está retrasado en cronograma (EV por debajo de PV) y tiene sobrecoste (AC por encima de EV).",
  ahead_over: "El proyecto está adelantado en cronograma (EV por encima de PV), pero tiene sobrecoste (AC por encima de EV): el adelanto se ha logrado gastando de más.",
  behind_under: "El proyecto está retrasado en cronograma (EV por debajo de PV), pero está por debajo de presupuesto (AC por debajo de EV): el ahorro de coste no compensa el retraso.",
};

function generateOne(): GeneratedQuestion {
  const periods = randInt(3, 5);
  const context = PROJECT_CONTEXTS[randInt(0, PROJECT_CONTEXTS.length - 1)];
  const pvFinal = randInt(60, 150);

  const scheduleStatus: ScheduleStatus = Math.random() < 0.5 ? "ahead" : "behind";
  const costStatus: CostStatus = Math.random() < 0.5 ? "under" : "over";

  // EV final: por encima o por debajo de PV final según el estado de cronograma.
  const evFinal = scheduleStatus === "ahead"
    ? pvFinal + randInt(5, Math.round(pvFinal * 0.25))
    : pvFinal - randInt(5, Math.round(pvFinal * 0.25));

  // AC final: por encima o por debajo de EV final según el estado de coste.
  const acFinal = costStatus === "over"
    ? evFinal + randInt(5, Math.round(evFinal * 0.25))
    : Math.max(1, evFinal - randInt(5, Math.round(evFinal * 0.2)));

  const pv = buildSeries(periods, pvFinal, Math.round(pvFinal * 0.05));
  const ev = buildSeries(periods, evFinal, Math.round(evFinal * 0.05));
  const ac = buildSeries(periods, acFinal, Math.round(acFinal * 0.05));
  const labels = Array.from({ length: periods }, (_, i) => `Mes ${i + 1}`);

  const correctKey = `${scheduleStatus}_${costStatus}` as `${ScheduleStatus}_${CostStatus}`;
  const correctText = SCENARIO_TEXT[correctKey];

  const allKeys = Object.keys(SCENARIO_TEXT) as (`${ScheduleStatus}_${CostStatus}`)[];
  const wrongKeys = allKeys.filter((k) => k !== correctKey);

  const distractors = wrongKeys.map((key) => {
    const [sched, cost] = key.split("_") as [ScheduleStatus, CostStatus];
    const scheduleWrong = sched !== scheduleStatus;
    const costWrong = cost !== costStatus;
    const errorType = scheduleWrong && costWrong ? "knowledge" : scheduleWrong ? "reading" : "analysis";
    return { text: SCENARIO_TEXT[key], error_type: errorType };
  });

  const letters = ["A", "B", "C", "D"];
  // Fisher-Yates para no sesgar la posición de la correcta.
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const optionEntries = [{ text: correctText, error_type: undefined as string | undefined }, ...distractors];
  const options = optionEntries.map((opt, idx) => ({
    id: letters[idx],
    text: opt.text,
    ...(opt.error_type ? { error_type: opt.error_type } : {}),
  }));
  const correctLetter = letters[0];

  const stem = `Observa la curva de valor ganado de ${context} tras el mes ${periods}. ¿Qué indica la relación entre las curvas de Valor Planificado (PV), Valor Ganado (EV) y Coste Real (AC)?`;

  const sv = evFinal - pvFinal;
  const cv = evFinal - acFinal;
  const explanation = `Al mes ${periods}: SV = EV − PV = ${evFinal} − ${pvFinal} = ${sv} (${sv >= 0 ? "adelantado" : "retrasado"} en cronograma). CV = EV − AC = ${evFinal} − ${acFinal} = ${cv} (${cv >= 0 ? "por debajo de presupuesto" : "sobrecoste"}). ${correctText}`;

  const difficulty = randInt(3, 4);

  return {
    stem,
    options,
    correct_answer: [correctLetter],
    explanation,
    difficulty,
    practicum_payload: { chart_type: "earned_value", evChart: { labels, pv, ev, ac } },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const body: { task_id: string; count?: number; approach?: string } = await req.json();
  if (!body.task_id) return errorResponse("Falta el campo task_id", 400);

  const count = Math.min(Math.max(body.count ?? 5, 1), 30);
  const admin = getSupabaseAdmin();

  const { data: task, error: taskErr } = await admin.from("eco_tasks").select("id, eco_domains(code)").eq("id", body.task_id).single();
  if (taskErr || !task) return errorResponse("Tarea ECO no encontrada", 404);

  const insertedIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const q = generateOne();
    const { data, error } = await admin
      .from("questions")
      .insert({
        item_type: "standalone",
        format: "graphic_based",
        stem: q.stem,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        task_id: body.task_id,
        approach: body.approach ?? "predictive",
        difficulty: q.difficulty,
        process_group: "monitoring_control", // interpretar EVM es inherentemente de seguimiento
        performance_domain: "finanzas", // valor ganado = finanzas por naturaleza del contenido
        status: "draft",
        practicum_payload: q.practicum_payload,
        generation_job_id: null,
      })
      .select("id")
      .single();
    if (!error && data) {
      insertedIds.push(data.id);
      await admin.from("question_tags").insert(tagRowsFor(data.id, {
        domainCode: (task as any).eco_domains?.code ?? "process",
        approach: body.approach ?? "predictive",
        processGroup: "monitoring_control",
        performanceDomain: "finanzas",
        themes: [],
        isCase: false,
        format: "graphic_based",
      }));
    }
  }

  return jsonResponse({ generated: insertedIds.length, requested: count, question_ids: insertedIds });
});
