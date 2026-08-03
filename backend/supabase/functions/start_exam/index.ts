// Edge Function: start_exam
//
// Genera una nueva sesión de examen respetando:
//  - Ponderación de dominios ECO 2026 (People 33% / Process 41% / Business Environment 26%)
//  - Split de enfoque 40% predictive / 60% agile+hybrid
//  - Bloques de case_cluster como unidad atómica (todas sus preguntas hijas, consecutivas)
//  - Restricciones de plan (básica no incluye practicum completo salvo que el plan lo indique)
//  - Estructura real de 3 secciones cronometradas independientes en full_sim (no un timer único),
//    sin partir nunca un cluster de caso entre dos secciones

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

type ExamMode = "full_sim" | "domain_drill" | "case_only" | "custom" | "unit_quiz" | "cumulative";

interface StartExamBody {
  mode: ExamMode;
  domain_codes?: string[];
  task_ids?: string[];
  question_count?: number;
  unit_id?: string; // requerido para unit_quiz y cumulative
  approach_filter?: "predictive" | "agile" | "hybrid" | "agile_hybrid"; // práctica dirigida por enfoque
}

const FULL_SIM_TOTAL = 180;
const FULL_SIM_SECTIONS = 3;
const FULL_SIM_TOTAL_SECONDS = 240 * 60;
const DOMAIN_WEIGHTS: Record<string, number> = {
  people: 0.33,
  process: 0.41,
  business_environment: 0.26,
};
const PREDICTIVE_SHARE = 0.4;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const body: StartExamBody = await req.json();
  const admin = getSupabaseAdmin();

  const { data: license, error: licenseErr } = await admin
    .from("licenses")
    .select("id, expires_at, status, free_full_sim_used, plans(code, includes_practicum_full)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (licenseErr) return errorResponse(licenseErr.message, 500);
  if (!license) return errorResponse("No tienes una licencia activa vigente", 403);

  const includesPracticumFull = (license as any).plans?.includes_practicum_full ?? false;
  const planCode = (license as any).plans?.code;

  if (body.mode === "full_sim") {
    const { data: gaps, error: gapsErr } = await admin.rpc("validate_bank_readiness");
    if (gapsErr) return errorResponse(gapsErr.message, 500);
    if (gaps && gaps.length > 0) {
      return errorResponse(
        `El banco no tiene cobertura completa: faltan preguntas publicadas en ${gaps.length} tarea(s) ECO.`,
        409,
      );
    }

    // El plan gratuito incluye UN simulacro completo de regalo, no limitado por tiempo
    // de sesión (a diferencia de competidores con cronómetro de prueba) sino por uso.
    if (planCode === "free" && (license as any).free_full_sim_used) {
      return errorResponse(
        "Ya usaste tu simulacro completo de regalo del plan gratuito. Mejora tu plan para simulacros ilimitados.",
        403,
      );
    }
  }

  // Resolver unit_id -> task_ids para los modos ligados al currículo propio (no ECO directamente).
  let resolvedTaskIds = body.task_ids;
  if (body.mode === "unit_quiz" || body.mode === "cumulative") {
    if (!body.unit_id) return errorResponse("Falta unit_id para este modo", 400);

    const { data: targetUnit, error: unitErr } = await admin
      .from("course_units")
      .select("id, sequence, status")
      .eq("id", body.unit_id)
      .single();
    if (unitErr || !targetUnit) return errorResponse("Unidad de currículo no encontrada", 404);
    if (targetUnit.status !== "published") return errorResponse("Esta unidad aún no está publicada", 403);

    if (body.mode === "unit_quiz") {
      const { data: mappings } = await admin
        .from("course_unit_tasks")
        .select("task_id")
        .eq("course_unit_id", body.unit_id);
      resolvedTaskIds = (mappings ?? []).map((m: any) => m.task_id);
    } else {
      // cumulative: todas las tareas de las unidades publicadas con sequence <= la unidad objetivo.
      const { data: mappings } = await admin
        .from("course_unit_tasks")
        .select("task_id, course_units!inner(sequence, status)")
        .lte("course_units.sequence", targetUnit.sequence)
        .eq("course_units.status", "published");
      resolvedTaskIds = [...new Set((mappings ?? []).map((m: any) => m.task_id))];
    }

    if (!resolvedTaskIds || resolvedTaskIds.length === 0) {
      return errorResponse("Esta unidad no tiene tareas ECO asociadas todavía", 409);
    }
  }

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
  if ((body.mode === "domain_drill" || body.mode === "custom" || body.mode === "unit_quiz" || body.mode === "cumulative") && resolvedTaskIds?.length) {
    query = query.in("task_id", resolvedTaskIds);
  }
  // Práctica dirigida por enfoque (predictivo/ágil/híbrido). Nunca se aplica en
  // full_sim, que ya tiene su propio reparto real 40/60 -- este filtro es solo para
  // los modos de práctica, cuando el candidato quiere entrenar un enfoque concreto.
  if (body.mode !== "full_sim" && body.approach_filter) {
    if (body.approach_filter === "agile_hybrid") {
      query = query.in("approach", ["agile", "hybrid"]);
    } else {
      query = query.eq("approach", body.approach_filter);
    }
  }

  const { data: pool, error: poolErr } = await query;
  if (poolErr) return errorResponse(poolErr.message, 500);
  if (!pool || pool.length === 0) return errorResponse("No hay preguntas disponibles para estos filtros", 404);

  const selected = body.mode === "full_sim"
    ? selectFullSim(pool)
    : selectDrill(pool, body.question_count ?? 50);

  // Averiguar qué ítems ya respondió el usuario en exámenes anteriores (para new_items_count
  // en finish_exam más adelante; aquí solo lo calculamos para dejarlo en config informativo).
  const { data: previousAnswers } = await admin
    .from("exam_items")
    .select("question_id, exams!inner(user_id)")
    .eq("exams.user_id", user.id)
    .not("answered_at", "is", null);
  const previouslySeenIds = new Set((previousAnswers ?? []).map((r: any) => r.question_id));

  const timeLimitSeconds = body.mode === "full_sim" ? FULL_SIM_TOTAL_SECONDS : null;

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

  if (body.mode === "full_sim" && planCode === "free") {
    await admin.from("licenses").update({ free_full_sim_used: true }).eq("id", license.id);
  }

  // Asignar section_number: en full_sim, 3 secciones reales sin partir clusters;
  // en el resto de modos, todo va a la sección 1 (no aplica la estructura de 3 bloques).
  const sectioned = body.mode === "full_sim"
    ? assignSections(selected, FULL_SIM_SECTIONS, FULL_SIM_TOTAL_SECONDS)
    : selected.map((q) => ({ ...q, section_number: 1 }));

  const examItems = sectioned.map((q: any, idx: number) => ({
    exam_id: exam.id,
    question_id: q.id,
    cluster_id: q.cluster_id,
    order_index: idx,
    section_number: q.section_number,
    is_pretest: false,
  }));

  const { error: itemsErr } = await admin.from("exam_items").insert(examItems);
  if (itemsErr) return errorResponse(itemsErr.message, 500);

  if (body.mode === "full_sim") {
    const sectionRows = buildSectionRows(sectioned, FULL_SIM_SECTIONS, FULL_SIM_TOTAL_SECONDS).map((s, idx) => ({
      exam_id: exam.id,
      section_number: idx + 1,
      total_questions: s.count,
      time_limit_seconds: s.seconds,
      status: idx === 0 ? "in_progress" : "pending",
      started_at: idx === 0 ? new Date().toISOString() : null,
    }));
    const { error: sectionsErr } = await admin.from("exam_sections").insert(sectionRows);
    if (sectionsErr) return errorResponse(sectionsErr.message, 500);
  }

  const { data: renderable } = await admin
    .from("questions")
    .select("id, item_type, format, cluster_id, stem, options, difficulty, practicum_payload, case_clusters(id, title, scenario_text, media)")
    .in("id", selected.map((q) => q.id));

  // No se filtra correct_answer/explanation aquí: ese campo ni siquiera se selecciona.
  const itemsWithMeta = (renderable ?? []).map((r: any) => ({
    ...r,
    section_number: sectioned.find((s: any) => s.id === r.id)?.section_number ?? 1,
    previously_seen: previouslySeenIds.has(r.id),
  }));

  return jsonResponse({
    exam_id: exam.id,
    mode: exam.mode,
    total_questions: exam.total_questions,
    time_limit_seconds: exam.time_limit_seconds,
    sections: body.mode === "full_sim" ? buildSectionRows(sectioned, FULL_SIM_SECTIONS, FULL_SIM_TOTAL_SECONDS) : null,
    items: itemsWithMeta,
  });
});

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

// Devuelve la lista ordenada respetando que los ítems de un mismo cluster queden consecutivos.
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

// Convierte la lista ordenada en "bloques" (un cluster completo = 1 bloque; un standalone = bloque de 1)
// para poder repartir en secciones sin partir nunca un cluster.
function toBlocks(items: any[]): any[][] {
  const blocks: any[][] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (item.cluster_id) {
      const block = [item];
      let j = i + 1;
      while (j < items.length && items[j].cluster_id === item.cluster_id) {
        block.push(items[j]);
        j++;
      }
      blocks.push(block);
      i = j;
    } else {
      blocks.push([item]);
      i++;
    }
  }
  return blocks;
}

// Estructura REAL del examen (ECO 2026, "Información sobre el examen de certificación de PMP"):
// "El primer descanso se toma después de la sección de estudio de casos, y el segundo descanso
// se toma aproximadamente a mitad de la parte de preguntas independientes del examen."
// Sección 1 = TODOS los clusters de caso (agrupados). Secciones 2 y 3 = las preguntas
// independientes (standalone), partidas por la mitad. No son 3 bloques genéricos de ~60.
function distributeBlocks(items: any[], _sectionCount: number): any[][] {
  const blocks = toBlocks(items);
  const caseBlocks = blocks.filter((b) => b[0].cluster_id);
  const standaloneBlocks = blocks.filter((b) => !b[0].cluster_id);

  const section1 = caseBlocks.flat();

  const standaloneItems = standaloneBlocks.flat();
  const midpoint = Math.ceil(standaloneItems.length / 2);
  const section2 = standaloneItems.slice(0, midpoint);
  const section3 = standaloneItems.slice(midpoint);

  return [section1, section2, section3];
}

function assignSections(items: any[], sectionCount: number, totalSeconds: number) {
  const sections = distributeBlocks(items, sectionCount);
  const withSection: any[] = [];
  sections.forEach((sectionItems, idx) => {
    for (const item of sectionItems) withSection.push({ ...item, section_number: idx + 1 });
  });
  return withSection;
}

function buildSectionRows(sectionedItems: any[], sectionCount: number, totalSeconds: number) {
  const counts: number[] = Array.from({ length: sectionCount }, () => 0);
  for (const item of sectionedItems) counts[item.section_number - 1]++;
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.map((count) => ({
    count,
    seconds: Math.round((count / total) * totalSeconds),
  }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
