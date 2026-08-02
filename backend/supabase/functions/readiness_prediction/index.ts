// Edge Function: readiness_prediction
//
// GET -> devuelve un indicador de NIVEL DE PREPARACIÓN (no una "probabilidad de
// aprobado"), disponible solo en planes con includes_analytics=true (Premium).
//
// IMPORTANTE: no existe una fórmula oficial ni datos públicos que permitan calcular una
// probabilidad real de aprobar el examen PMP a partir del desempeño en un simulador —
// nadie tiene eso calibrado con miles de resultados reales. Presentar un "% de
// probabilidad de aprobar" sería una afirmación pseudocientífica. En su lugar, se
// calcula un indicador cualitativo (bajo/moderado/bueno/alto) a partir de:
//   1. Mastery ponderado por los pesos reales de dominio del ECO 2026 (33/41/26)
//   2. Tendencia de los últimos simulacros completos (si existen)
// Siempre se devuelve con un disclaimer explícito.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

const DOMAIN_WEIGHTS: Record<string, number> = {
  people: 0.33,
  process: 0.41,
  business_environment: 0.26,
};

const READINESS_DISCLAIMER =
  "Este indicador es una estimación propia de PMTech Simulator basada en tu dominio " +
  "por tarea y tu tendencia en simulacros recientes — no es una probabilidad real de " +
  "aprobar el examen oficial. Nadie puede calcularla con precisión: PMI no publica una " +
  "nota de corte ni datos que permitan calibrar esa cifra. Úsalo como una guía relativa " +
  "de tu progreso, no como una garantía.";

const MIN_ANSWERED_FOR_PREDICTION = 20; // por debajo de esto, la señal es poco fiable

function bandFor(score: number): string {
  if (score >= 80) return "Alto";
  if (score >= 65) return "Bueno";
  if (score >= 45) return "Moderado";
  return "Bajo";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const admin = getSupabaseAdmin();

  const { data: license } = await admin
    .from("licenses")
    .select("id, plans(includes_analytics)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const includesAnalytics = (license as any)?.plans?.includes_analytics ?? false;
  if (!includesAnalytics) {
    return errorResponse("Esta función requiere un plan con analítica avanzada (Premium)", 403);
  }

  // Mastery por tarea -> agregado por dominio, ponderado por los pesos reales del ECO 2026.
  const { data: masteryRows } = await admin
    .from("user_task_mastery")
    .select("mastery_pct, attempts, correct, eco_tasks(domain_id, eco_domains(code))")
    .eq("user_id", user.id);

  const totalAnswered = (masteryRows ?? []).reduce((sum: number, r: any) => sum + (r.attempts ?? 0), 0);

  if (totalAnswered < MIN_ANSWERED_FOR_PREDICTION) {
    return jsonResponse({
      data_sufficient: false,
      message: `Practica al menos ${MIN_ANSWERED_FOR_PREDICTION} preguntas para desbloquear tu indicador de nivel de preparación (llevas ${totalAnswered}).`,
      disclaimer: READINESS_DISCLAIMER,
    });
  }

  const byDomain: Record<string, { totalPct: number; count: number }> = {};
  for (const row of masteryRows as any[]) {
    const code = row.eco_tasks?.eco_domains?.code;
    if (!code) continue;
    byDomain[code] = byDomain[code] ?? { totalPct: 0, count: 0 };
    byDomain[code].totalPct += Number(row.mastery_pct ?? 0);
    byDomain[code].count += 1;
  }

  let masteryScore = 0;
  let weightUsed = 0;
  const scoreByDomain: Record<string, number> = {};
  for (const [code, weight] of Object.entries(DOMAIN_WEIGHTS)) {
    const d = byDomain[code];
    if (!d || d.count === 0) continue;
    const avg = d.totalPct / d.count;
    scoreByDomain[code] = Math.round(avg * 100) / 100;
    masteryScore += avg * weight;
    weightUsed += weight;
  }
  const masteryComponent = weightUsed > 0 ? masteryScore / weightUsed : 0;

  // Tendencia: media de los últimos 3 simulacros completos (full_sim) finalizados.
  const { data: recentFullSims } = await admin
    .from("exams")
    .select("score_pct, finished_at")
    .eq("user_id", user.id)
    .eq("mode", "full_sim")
    .eq("status", "completed")
    .order("finished_at", { ascending: false })
    .limit(3);

  const fullSimScores = (recentFullSims ?? []).map((e: any) => Number(e.score_pct ?? 0));
  const fullSimComponent = fullSimScores.length > 0
    ? fullSimScores.reduce((a: number, b: number) => a + b, 0) / fullSimScores.length
    : null;

  // Si hay simulacros completos recientes, pesan más que el mastery de práctica suelta
  // (son la señal más parecida a condiciones reales); si no hay ninguno, solo mastery.
  const readinessScore = fullSimComponent !== null
    ? Math.round((masteryComponent * 0.4 + fullSimComponent * 0.6) * 100) / 100
    : Math.round(masteryComponent * 100) / 100;

  return jsonResponse({
    data_sufficient: true,
    readiness_score: readinessScore,
    band: bandFor(readinessScore),
    score_by_domain: scoreByDomain,
    based_on_full_sims: fullSimScores.length,
    disclaimer: READINESS_DISCLAIMER,
  });
});
