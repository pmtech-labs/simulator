// Edge Function: start_exam
//
// Genera una nueva sesión de examen respetando:
//  - Ponderación de dominios ECO 2026 (People 33% / Process 41% / Business Environment 26%)
//  - Split de enfoque 40% predictive / 60% agile+hybrid
//  - Bloques de case_cluster como unidad atómica (todas sus preguntas hijas, consecutivas)
//  - Restricciones de plan (básica no incluye practicum completo salvo que el plan lo indique)
//
// Ver especificación técnica, sección 3 (esquema) y sección 3 del prompt de Cowork.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

type ExamMode = "full_sim" | "domain_drill" | "case_only" | "custom";

interface StartExamBody {
  mode: ExamMode;
  domain_codes?: string[]; // para domain_drill / custom
  task_ids?: string[]; // para domain_drill / custom
  question_count?: number; // para domain_drill / custom, ignorado en full_sim
}

const FULL_SIM_TOTAL = 180;
const FULL_SIM_PRETEST = 10;
const DOMAIN_WEIGHTS: Record<string, number> = {
  people: 0.33,
  process: 0.41,
  business_environment: 0.26,
};
const PREDICTIVE_SHARE = 0.4; // 40% predictive, 60% agile+hybrid combinados

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const body: StartExamBody = await req.json();
  const admin = getSupabaseAdmin();

  // 1. Verificar licencia activa y vigente
  const { data: license, error: licenseErr } = await admin
    .from("licenses")
    .select("id, expires_at, status, plans(code, includes_practicum_full)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (licenseErr) return errorResponse(licenseErr.message, 500);
  if (!license) return errorResponse("No tienes una licencia activa vigente", 403);

  const includesPracticumFull = (license as any).plans?.includes_practicum_full ?? false;

  // 2. Si es full_sim, verificar que el banco tenga cobertura completa (26/26 tareas)
  if (body.mode === "full_sim") {
    const { data: gaps, error: gapsErr } = await admin.rpc("validate_bank_readiness");
    if (gapsErr) return errorResponse(gapsErr.message, 500);
    if (gaps && gaps.length > 0) {
      return errorResponse(
        `El banco no tiene cobertura completa: faltan preguntas publicadas en ${gaps.length} tarea(s) ECO.`,
        409,
      );
    }
  }

  // 3. Construir el pool de selección según modo
  let query = admin
    .from("questions")
    .select("id, item_type, format, cluster_id, task_id, approach, eco_tasks(domain_id, eco_domains(code))")
    .eq("status", "published");

  if (!includesPracticumFull) {
    query = query.neq("format", "hotspot").neq("format", "graphic_based");
  }
  if (body.mode === "case_only") {
    query = query.eq("item_type", "case_child");
  }
  if ((body.mode === "domain_drill" || body.mode === "custom") && body.task_ids?.length) {
    query = query.in("task_id", body.task_ids);
  }

  const { data: pool, error: poolErr } = await query;
  if (poolErr) return errorResponse(poolErr.message, 500);
  if (!pool || pool.length === 0) return errorResponse("No hay preguntas disponibles para estos filtros", 404);

  // 4. Seleccionar ítems según el modo
  const selected = body.mode === "full_sim"
    ? selectFullSim(pool)
    : selectDrill(pool, body.question_count ?? 50);

  // 5. Crear el examen y sus items (clusters agrupados y consecutivos)
  const timeLimitSeconds = body.mode === "full_sim" ? 240 * 60 : null;

  const { data: exam, error: examErr } = await admin
    .from("exams")
    .insert({
      user_id: user.id,
      license_id: license.id,
      mode: body.mode,
      config: body,
      total_questions: selected.length,
      time_limit_seconds: timeLimitSeconds,
      status: "in_progress",
    })
    .select()
    .single();

  if (examErr) return errorResponse(examErr.message, 500);

  const examItems = selected.map((q, idx) => ({
    exam_id: exam.id,
    question_id: q.id,
    cluster_id: q.cluster_id,
    order_index: idx,
    is_pretest: false, // el marcado real de pretest se gestiona en el pipeline de contenido, no aquí
  }));

  const { error: itemsErr } = await admin.from("exam_items").insert(examItems);
  if (itemsErr) return errorResponse(itemsErr.message, 500);

  // 6. Devolver al frontend solo lo necesario para renderizar (sin correct_answer)
  const { data: renderable } = await admin
    .from("questions")
    .select("id, item_type, format, cluster_id, stem, options, practicum_payload, case_clusters(id, title, scenario_text, media)")
    .in("id", selected.map((q) => q.id));

  return jsonResponse({
    exam_id: exam.id,
    mode: exam.mode,
    total_questions: exam.total_questions,
    time_limit_seconds: exam.time_limit_seconds,
    items: renderable,
  });
});

// Selección ponderada para examen completo: respeta pesos de dominio y split de enfoque,
// y trata cada cluster como bloque atómico (todas sus preguntas hijas entran juntas).
function selectFullSim(pool: any[]) {
  const targetTotal = FULL_SIM_TOTAL;
  const byDomain: Record<string, any[]> = { people: [], process: [], business_environment: [] };

  for (const q of pool) {
    const domainCode = q.eco_tasks?.eco_domains?.code;
    if (domainCode && byDomain[domainCode]) byDomain[domainCode].push(q);
  }

  const result: any[] = [];
  for (const [domainCode, weight] of Object.entries(DOMAIN_WEIGHTS)) {
    const targetCount = Math.round(targetTotal * weight);
    const domainPool = byDomain[domainCode] ?? [];
    const predictiveTarget = Math.round(targetCount * PREDICTIVE_SHARE);

    const predictive = shuffle(domainPool.filter((q) => q.approach === "predictive")).slice(0, predictiveTarget);
    const agileHybrid = shuffle(domainPool.filter((q) => q.approach !== "predictive")).slice(
      0,
      targetCount - predictive.length,
    );

    result.push(...groupClusters([...predictive, ...agileHybrid]));
  }

  return result.slice(0, targetTotal);
}

function selectDrill(pool: any[], count: number) {
  return groupClusters(shuffle(pool)).slice(0, count);
}

// Asegura que si entra una pregunta hija de un cluster, entran todas sus hermanas, consecutivas.
function groupClusters(items: any[]) {
  const seenClusters = new Set<string>();
  const ordered: any[] = [];
  const byCluster: Record<string, any[]> = {};

  for (const item of items) {
    if (item.cluster_id) {
      byCluster[item.cluster_id] = byCluster[item.cluster_id] ?? [];
      byCluster[item.cluster_id].push(item);
    }
  }

  for (const item of items) {
    if (!item.cluster_id) {
      ordered.push(item);
      continue;
    }
    if (seenClusters.has(item.cluster_id)) continue;
    seenClusters.add(item.cluster_id);
    ordered.push(...byCluster[item.cluster_id]);
  }

  return ordered;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
