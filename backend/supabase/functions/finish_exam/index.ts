// Edge Function: finish_exam
//
// Cierra la sesión de examen y calcula:
//  - score_pct global
//  - score_by_domain (People/Process/Business Environment)
//  - score_by_approach (predictive/agile/hybrid)
//  - new_items_count / repeated_items_count: cuántos ítems eran nuevos para el usuario vs.
//    ya respondidos en exámenes anteriores. Un score alto con muchos ítems repetidos no debe
//    interpretarse como preparación real (ver SIMULADOR PMP - VISIÓN GENERAL.docx).

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface FinishExamBody {
  exam_id: string;
}

const RESULT_DISCLAIMER =
  "Este resultado es una estimación razonada de tu nivel de preparación: entrena tu " +
  "razonamiento, tu concentración y tu gestión del tiempo, pero no garantiza el aprobado en " +
  "el examen real. Complementa esta práctica con estudio estructurado, revisión de tus " +
  "errores, práctica progresiva y tu propia experiencia profesional.";

// PMI no publica una nota de corte oficial para el examen PMP (usa bandas de desempeño
// por dominio: Above/Target/Below Target, sin porcentaje público). Este umbral es un
// criterio de referencia propio de PMTech Simulator para emitir el diploma de logro —
// debe declararse siempre como tal, nunca presentarse como la nota de corte real de PMI.
const DIPLOMA_THRESHOLD_PCT = 65;
const DIPLOMA_DISCLAIMER =
  "Este diploma reconoce tu desempeño en un simulacro completo según un criterio de " +
  "referencia propio de PMTech Simulator. PMI no publica una nota de corte oficial para " +
  "el examen PMP real — usa bandas de desempeño por dominio, no un porcentaje público.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const body: FinishExamBody = await req.json();
  const admin = getSupabaseAdmin();

  const { data: exam, error: examErr } = await admin
    .from("exams")
    .select("id, user_id, status, mode")
    .eq("id", body.exam_id)
    .single();

  if (examErr || !exam) return errorResponse("Examen no encontrado", 404);
  if (exam.user_id !== user.id) return errorResponse("No autorizado", 403);
  if (exam.status === "completed") return errorResponse("El examen ya estaba cerrado", 409);

  const { data: items, error: itemsErr } = await admin
    .from("exam_items")
    .select("is_correct, question_id, questions(approach, eco_tasks(eco_domains(code)))")
    .eq("exam_id", exam.id);

  if (itemsErr) return errorResponse(itemsErr.message, 500);
  if (!items || items.length === 0) return errorResponse("El examen no tiene ítems", 400);

  const total = items.length;
  const correctCount = items.filter((i: any) => i.is_correct).length;
  const scorePct = Math.round((correctCount / total) * 10000) / 100;

  const byDomain: Record<string, { correct: number; total: number }> = {};
  const byApproach: Record<string, { correct: number; total: number }> = {};

  for (const item of items as any[]) {
    const domainCode = item.questions?.eco_tasks?.eco_domains?.code ?? "unknown";
    const approach = item.questions?.approach ?? "unknown";

    byDomain[domainCode] = byDomain[domainCode] ?? { correct: 0, total: 0 };
    byDomain[domainCode].total += 1;
    if (item.is_correct) byDomain[domainCode].correct += 1;

    byApproach[approach] = byApproach[approach] ?? { correct: 0, total: 0 };
    byApproach[approach].total += 1;
    if (item.is_correct) byApproach[approach].correct += 1;
  }

  const toPctMap = (m: Record<string, { correct: number; total: number }>) =>
    Object.fromEntries(
      Object.entries(m).map(([k, v]) => [k, Math.round((v.correct / v.total) * 10000) / 100]),
    );

  const scoreByDomain = toPctMap(byDomain);
  const scoreByApproach = toPctMap(byApproach);

  // Ítems repetidos: el usuario ya había respondido esa question_id en OTRO examen antes.
  const questionIds = items.map((i: any) => i.question_id);
  const { data: priorAnswers } = await admin
    .from("exam_items")
    .select("question_id, exams!inner(user_id, id)")
    .in("question_id", questionIds)
    .eq("exams.user_id", user.id)
    .neq("exams.id", exam.id)
    .not("answered_at", "is", null);

  const repeatedIds = new Set((priorAnswers ?? []).map((r: any) => r.question_id));
  const repeatedItemsCount = questionIds.filter((id: string) => repeatedIds.has(id)).length;
  const newItemsCount = total - repeatedItemsCount;

  const { error: updateErr } = await admin
    .from("exams")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      score_pct: scorePct,
      score_by_domain: scoreByDomain,
      score_by_approach: scoreByApproach,
      new_items_count: newItemsCount,
      repeated_items_count: repeatedItemsCount,
    })
    .eq("id", exam.id);

  if (updateErr) return errorResponse(updateErr.message, 500);

  let diploma: { id: string; issued_at: string } | null = null;
  if (exam.mode === "full_sim" && scorePct >= DIPLOMA_THRESHOLD_PCT) {
    const { data: diplomaRow, error: diplomaErr } = await admin
      .from("diplomas")
      .insert({
        user_id: user.id,
        exam_id: exam.id,
        score_pct: scorePct,
        score_by_domain: scoreByDomain,
        threshold_pct: DIPLOMA_THRESHOLD_PCT,
      })
      .select("id, issued_at")
      .single();
    // No se bloquea la respuesta del examen si falla la emisión del diploma (ej. ya
    // existía por un reintento) — el resultado del examen es lo prioritario.
    if (!diplomaErr && diplomaRow) diploma = diplomaRow;
  }

  return jsonResponse({
    exam_id: exam.id,
    score_pct: scorePct,
    score_by_domain: scoreByDomain,
    score_by_approach: scoreByApproach,
    new_items_count: newItemsCount,
    repeated_items_count: repeatedItemsCount,
    disclaimer: RESULT_DISCLAIMER,
    interpretation_note: repeatedItemsCount > total * 0.3
      ? "Más del 30% de las preguntas ya las habías respondido antes: este resultado puede sobreestimar tu preparación real."
      : null,
    diploma: diploma
      ? { id: diploma.id, issued_at: diploma.issued_at, threshold_pct: DIPLOMA_THRESHOLD_PCT, disclaimer: DIPLOMA_DISCLAIMER }
      : null,
  });
});
