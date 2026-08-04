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

type ExamMode = "full_sim" | "half_sim" | "domain_drill" | "case_only" | "custom" | "unit_quiz" | "cumulative";

interface StartExamBody {
  mode: ExamMode;
  domain_codes?: string[];
  task_ids?: string[];
  question_count?: number;
  unit_id?: string; // requerido para unit_quiz y cumulative
  approach_filter?: "predictive" | "agile" | "hybrid" | "agile_hybrid"; // práctica dirigida por enfoque
  process_group_filter?: string; // práctica dirigida por área de enfoque/grupo de proceso
  performance_domain_filter?: string; // práctica dirigida por dominio de desempeño
}

const FULL_SIM_TOTAL = 180;
const FULL_SIM_SECTIONS = 3;
const FULL_SIM_TOTAL_SECONDS = 240 * 60;
// Requisito del PO: "medio examen" -- 90 preguntas / 2h, manteniendo los MISMOS
// criterios de % que el examen completo (dominio/enfoque/área de enfoque/dominio de
// desempeño/formato/temáticas) -- sin la estructura de 3 bloques + revisión +
// descansos de R5-R7, que el PO solo especificó para el examen completo de 180.
const HALF_SIM_TOTAL = 90;
const HALF_SIM_TOTAL_SECONDS = 120 * 60;
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

  if (body.mode === "full_sim" || body.mode === "half_sim") {
    const { data: gaps, error: gapsErr } = await admin.rpc("validate_bank_readiness");
    if (gapsErr) return errorResponse(gapsErr.message, 500);
    if (gaps && gaps.length > 0) {
      return errorResponse(
        `El banco no tiene cobertura completa: faltan preguntas publicadas en ${gaps.length} tarea(s) ECO.`,
        409,
      );
    }
  }

  if (body.mode === "full_sim") {
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
    .select("id, item_type, format, cluster_id, task_id, approach, process_group, performance_domain, focus_tags, eco_tasks(domain_id, eco_domains(code))")
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
  // Práctica dirigida por área de enfoque (grupo de proceso) o dominio de desempeño.
  // Igual que approach_filter: nunca se aplica en full_sim, que ya tiene su propio
  // reparto real -- solo tiene sentido cuando el candidato quiere entrenar
  // específicamente una etapa del ciclo de vida o un dominio de desempeño concreto.
  if (body.mode !== "full_sim" && body.process_group_filter) {
    query = query.eq("process_group", body.process_group_filter);
  }
  if (body.mode !== "full_sim" && body.performance_domain_filter) {
    query = query.eq("performance_domain", body.performance_domain_filter);
  }

  const { data: pool, error: poolErr } = await query;
  if (poolErr) return errorResponse(poolErr.message, 500);
  if (!pool || pool.length === 0) return errorResponse("No hay preguntas disponibles para estos filtros", 404);

  const selected = body.mode === "full_sim"
    ? selectFullSim(pool)
    : body.mode === "half_sim"
    ? selectHalfSim(pool)
    : selectDrill(pool, body.question_count ?? 50);

  // Averiguar qué ítems ya respondió el usuario en exámenes anteriores (para new_items_count
  // en finish_exam más adelante; aquí solo lo calculamos para dejarlo en config informativo).
  const { data: previousAnswers } = await admin
    .from("exam_items")
    .select("question_id, exams!inner(user_id)")
    .eq("exams.user_id", user.id)
    .not("answered_at", "is", null);
  const previouslySeenIds = new Set((previousAnswers ?? []).map((r: any) => r.question_id));

  // Requisito del PO: el cronómetro SOLO aparece en el simulacro completo (180/4h) y
  // en el medio examen (90/2h) -- el resto de modos de práctica no tienen límite de
  // tiempo estricto (time_limit_seconds queda null, que es como el frontend sabe que
  // no debe mostrar ningún reloj).
  const timeLimitSeconds = body.mode === "full_sim"
    ? FULL_SIM_TOTAL_SECONDS
    : body.mode === "half_sim"
    ? HALF_SIM_TOTAL_SECONDS
    : null;

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
    .select("id, item_type, format, cluster_id, stem, options, difficulty, process_group, performance_domain, focus_tags, practicum_payload, case_clusters(id, title, scenario_text, media)")
    .in("id", selected.map((q) => q.id));

  // BUG encontrado (numeración de preguntas descolocada, ej. "1, 8, 9, 10, 11..." en
  // vez de 1-60 secuencial por bloque): .in("id", ...) devuelve las filas en el orden
  // de la base de datos, NO en el orden real ya calculado en `sectioned` (bloques +
  // secuencia). Aquí se reordena `itemsWithMeta` según ESE orden antes de numerar --
  // la numeración 1-180 debe asignarse la ÚLTIMA, sobre la lista ya ordenada por
  // bloque, nunca antes.
  const orderIndexById = new Map(sectioned.map((q: any, idx: number) => [q.id, idx]));
  const sectionNumberById = new Map(sectioned.map((q: any) => [q.id, q.section_number]));
  const renderableById = new Map((renderable ?? []).map((r: any) => [r.id, r]));

  const itemsWithMeta = sectioned
    .map((q: any) => renderableById.get(q.id))
    .filter((r: any): r is any => !!r)
    .map((r: any) => ({
      ...r,
      section_number: sectionNumberById.get(r.id) ?? 1,
      order_index: orderIndexById.get(r.id),
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

// Requisito del PO (R1): además del reparto oficial por dominio (33/41/26) y enfoque
// (40/60), equilibrar también por Área de Enfoque/grupo de proceso (20% cada uno) y
// por Nueva Temática (50% entrega de valor / 10% sostenibilidad / 10% IA / 30% ninguna)
// -- best-effort: dominio y enfoque son el requisito oficial del ECO 2026 y tienen
// prioridad; grupo de proceso y temática se reparten dentro de lo que el banco permita
// en cada momento (con un banco todavía pequeño, no siempre se podrá llegar al 20%/
// 50% exactos, pero el reparto activo hace que se acerque en vez de quedar al azar).
function selectSim(pool: any[], targetTotal: number) {
  const byDomain: Record<string, any[]> = { people: [], process: [], business_environment: [] };

  for (const q of pool) {
    const domainCode = q.eco_tasks?.eco_domains?.code;
    if (domainCode && byDomain[domainCode]) byDomain[domainCode].push(q);
  }

  // Actualización del PO: Áreas de Enfoque pasan de 20/20/20/20/20 a 10/30/20/30/10.
  const pgTargets: Record<string, number> = {
    initiation: Math.round(targetTotal * 0.1),
    planning: Math.round(targetTotal * 0.3),
    execution: Math.round(targetTotal * 0.2),
    monitoring_control: Math.round(targetTotal * 0.3),
    closing: Math.round(targetTotal * 0.1),
  };
  const pgCounts: Record<string, number> = { initiation: 0, planning: 0, execution: 0, monitoring_control: 0, closing: 0 };

  // Requisito del PO: "Dominios de Desempeño", ~14-15% cada uno de los 7. Sin cambios.
  const PERFORMANCE_DOMAINS = ["gobernanza", "alcance", "cronograma", "finanzas", "recursos", "riesgos", "interesados"];
  const pdTargets: Record<string, number> = {
    gobernanza: Math.round(targetTotal * 0.15), alcance: Math.round(targetTotal * 0.14),
    cronograma: Math.round(targetTotal * 0.14), finanzas: Math.round(targetTotal * 0.14),
    recursos: Math.round(targetTotal * 0.14), riesgos: Math.round(targetTotal * 0.14),
    interesados: Math.round(targetTotal * 0.15),
  };
  const pdCounts: Record<string, number> = Object.fromEntries(PERFORMANCE_DOMAINS.map((d) => [d, 0]));

  const themeTargets: Record<string, number> = {
    entrega_valor: Math.round(targetTotal * 0.5),
    sostenibilidad: Math.round(targetTotal * 0.1),
    ia: Math.round(targetTotal * 0.1),
  };
  const themeCounts: Record<string, number> = { entrega_valor: 0, sostenibilidad: 0, ia: 0 };
  let ninguna = 0;
  const ningunaTarget = Math.round(targetTotal * 0.3);

  function tagsOf(q: any): string[] {
    return q.focus_tags ?? [];
  }

  // Requisito del PO: bucket de formato al que pertenece cada pregunta -- "caso" se
  // trata aparte (todas van al bloque 1, ver assignBlocksOfSixty); mc_single, mc_multi
  // e interactivas (matching/enhanced_matching/hotspot/pulldown/graphic_based) son las
  // 3 categorías con cuota propia dentro del resto.
  function formatKeyOf(q: any): string {
    if (q.item_type === "case_child") return "caso";
    if (q.format === "mc_single") return "mc_single";
    if (q.format === "mc_multi") return "mc_multi";
    return "interactivas";
  }

  function stratifiedScore(q: any): number {
    const pgRoom = q.process_group && pgCounts[q.process_group] !== undefined
      ? Math.max(0, pgTargets[q.process_group] - pgCounts[q.process_group])
      : 0;
    const pdRoom = q.performance_domain && pdCounts[q.performance_domain] !== undefined
      ? Math.max(0, pdTargets[q.performance_domain] - pdCounts[q.performance_domain])
      : 0;
    const tags = tagsOf(q);
    const thRoom = tags.length > 0
      ? tags.reduce((sum, t) => sum + (themeTargets[t] !== undefined ? Math.max(0, themeTargets[t] - themeCounts[t]) : 0), 0)
      : Math.max(0, ningunaTarget - ninguna);
    return pgRoom + pdRoom + thRoom + Math.random();
  }

  function buildBlocks(items: any[]): any[][] {
    const seen = new Set<string>();
    const byCluster: Record<string, any[]> = {};
    for (const it of items) if (it.cluster_id) (byCluster[it.cluster_id] ??= []).push(it);
    const blocks: any[][] = [];
    for (const it of items) {
      if (it.cluster_id) {
        if (seen.has(it.cluster_id)) continue;
        seen.add(it.cluster_id);
        blocks.push(byCluster[it.cluster_id]);
      } else {
        blocks.push([it]);
      }
    }
    return blocks;
  }

  function pickStratifiedBlocks(blocks: any[][], targetItemCount: number): any[] {
    const picked: any[] = [];
    const remaining = [...blocks];
    let count = 0;
    while (count < targetItemCount && remaining.length > 0) {
      remaining.sort((a, b) => stratifiedScore(b[0]) - stratifiedScore(a[0]));
      const block = remaining.shift()!;
      picked.push(...block);
      count += block.length;
      for (const item of block) {
        if (item.process_group && pgCounts[item.process_group] !== undefined) pgCounts[item.process_group]++;
        if (item.performance_domain && pdCounts[item.performance_domain] !== undefined) pdCounts[item.performance_domain]++;
        const tags = tagsOf(item);
        if (tags.length > 0) {
          for (const t of tags) if (themeCounts[t] !== undefined) themeCounts[t]++;
        } else {
          ninguna++;
        }
      }
    }
    return picked;
  }

  // Elige `target` preguntas de un formato concreto DENTRO de un dominio, repartiendo
  // también por enfoque 40/60 dentro de ese formato (antes el enfoque se repartía a
  // nivel de dominio entero; ahora se anida dentro de cada bucket de formato).
  function pickFormatBucket(domainNonCaseItems: any[], formatKey: string, target: number): any[] {
    const bucketPool = domainNonCaseItems.filter((q) => formatKeyOf(q) === formatKey);
    const predictiveTarget = Math.round(target * PREDICTIVE_SHARE);
    const predictiveBlocks = shuffle(buildBlocks(bucketPool.filter((q) => q.approach === "predictive")));
    const predictive = pickStratifiedBlocks(predictiveBlocks, predictiveTarget);
    const agileHybridBlocks = shuffle(buildBlocks(bucketPool.filter((q) => q.approach !== "predictive")));
    const agileHybrid = pickStratifiedBlocks(agileHybridBlocks, Math.max(0, target - predictive.length));
    return [...predictive, ...agileHybrid];
  }

  // Recorta al total objetivo sin partir nunca un cluster (ver migración 0041).
  function trimToTarget(items: any[], target: number): any[] {
    let result = [...items];
    if (result.length <= target) return result;
    for (let i = result.length - 1; i >= 0 && result.length > target; i--) {
      if (!result[i].cluster_id) result.splice(i, 1);
    }
    while (result.length > target) {
      const lastIdx = result.length - 1;
      const clusterId = result[lastIdx].cluster_id;
      result = result.filter((it) => it.cluster_id !== clusterId);
    }
    return result;
  }

  // Requisito del PO: Formato pasa de 60-70% test / 20-25% casos / 10-15% interactivas
  // a 60% opción única / 10% opción múltiple / 20% casos / 10% interactivas.
  const casoTarget = Math.round(targetTotal * 0.2);
  const FORMAT_SHARE_OF_NONCASO = { mc_single: 0.75, mc_multi: 0.125, interactivas: 0.125 }; // 60/10/10 relativo al 80% no-caso

  const result: any[] = [];
  for (const [domainCode, weight] of Object.entries(DOMAIN_WEIGHTS)) {
    const targetCount = Math.round(targetTotal * weight);
    const domainItems = byDomain[domainCode] ?? [];
    const domainCasoTarget = Math.round(casoTarget * weight);

    const casoBlocksAll = buildBlocks(domainItems.filter((q) => q.item_type === "case_child"));
    const casoPicked = pickStratifiedBlocks(shuffle(casoBlocksAll), domainCasoTarget);

    const nonCaseItems = domainItems.filter((q) => q.item_type !== "case_child");
    const remaining = Math.max(0, targetCount - casoPicked.length);

    let mcSingleTarget = Math.round(remaining * FORMAT_SHARE_OF_NONCASO.mc_single);
    const mcMultiTarget = Math.round(remaining * FORMAT_SHARE_OF_NONCASO.mc_multi);
    const interactivasTarget = Math.max(0, remaining - mcSingleTarget - mcMultiTarget);

    const mcMultiPicked = pickFormatBucket(nonCaseItems, "mc_multi", mcMultiTarget);
    const interactivasPicked = pickFormatBucket(nonCaseItems, "interactivas", interactivasTarget);
    // Lo que no se cubra de mc_multi/interactivas por falta de banco se redirige a
    // mc_single (formato base) -- así el examen no se queda corto de preguntas por un
    // hueco de contenido en un formato todavía minoritario en el banco.
    const shortfall = (mcMultiTarget - mcMultiPicked.length) + (interactivasTarget - interactivasPicked.length);
    mcSingleTarget += Math.max(0, shortfall);
    const mcSinglePicked = pickFormatBucket(nonCaseItems, "mc_single", mcSingleTarget);

    result.push(...groupClusters([...casoPicked, ...mcSinglePicked, ...mcMultiPicked, ...interactivasPicked]));
  }

  return trimToTarget(result, targetTotal);
}

function selectFullSim(pool: any[]) {
  return selectSim(pool, FULL_SIM_TOTAL);
}

// Requisito del PO: "medio examen" -- mismos criterios de % que el examen completo,
// escalados a 90 preguntas (la función selectSim ya trabaja en porcentajes relativos
// al targetTotal que se le pase, así que reutilizarla aquí conserva exactamente las
// mismas proporciones de dominio/enfoque/área de enfoque/dominio de desempeño/
// formato/temáticas, sin duplicar la lógica).
function selectHalfSim(pool: any[]) {
  return selectSim(pool, HALF_SIM_TOTAL);
}

// Requisito del PO (R5): un examen completo se divide en 3 bloques de EXACTAMENTE 60
// preguntas cada uno. TODAS las preguntas de tipo caso/escenario van en el bloque 1;
// el resto del bloque 1 y los bloques 2 y 3 se completan con el resto de tipos.
function toBlocksAtomic(items: any[]): any[][] {
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

function assignBlocksOfSixty(items: any[]): any[][] {
  const blocks = toBlocksAtomic(items);
  const caseBlocks = blocks.filter((b) => b[0].cluster_id);
  const nonCaseBlocks = blocks.filter((b) => !b[0].cluster_id);

  const caseItems = caseBlocks.flat();
  const nonCaseItems = shuffle(nonCaseBlocks.flat());

  const fillNeeded = Math.max(0, 60 - caseItems.length);
  const block1Filler = nonCaseItems.slice(0, fillNeeded);
  const rest = nonCaseItems.slice(fillNeeded);
  const block2 = rest.slice(0, 60);
  const block3 = rest.slice(60, 120);

  return [[...caseItems, ...block1Filler], block2, block3];
}function selectDrill(pool: any[], count: number) {
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

// Estructura REAL del examen (ECO 2026, actualización del PO R5): 3 bloques de
// EXACTAMENTE 60 preguntas, con todos los casos en el bloque 1 (ver
// assignBlocksOfSixty más arriba, junto a selectFullSim). El descanso sigue
// tomándose entre bloques, tal como documenta el ECO 2026 real (sin cambios en R6).
function assignSections(items: any[], sectionCount: number, totalSeconds: number) {
  const sections = assignBlocksOfSixty(items);
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
