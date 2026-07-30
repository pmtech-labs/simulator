// Edge Function: submit_answer
//
// Corrige una respuesta, actualiza exam_items, la telemetría agregada del ítem
// (questions.times_answered/times_correct) y el mastery por tarea ECO del usuario.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface SubmitAnswerBody {
  exam_id: string;
  question_id: string;
  user_answer: string[]; // ids de opción(es) seleccionada(s), o payload de matching/hotspot
  time_spent_seconds?: number;
}

function isCorrect(userAnswer: unknown, correctAnswer: unknown): boolean {
  // Comparación por conjunto para mc_single / mc_multi.
  // Para formatos practicum (matching/hotspot) se asume que ambos payloads son
  // arrays de pares normalizados; si el formato requiere lógica distinta,
  // extiende esta función por `format` (pasar el format en el body si hace falta).
  if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
    const a = [...userAnswer].sort();
    const b = [...correctAnswer].sort();
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const body: SubmitAnswerBody = await req.json();
  const admin = getSupabaseAdmin();

  // 1. Verificar que el examen pertenece al usuario y está en curso
  const { data: exam, error: examErr } = await admin
    .from("exams")
    .select("id, user_id, status")
    .eq("id", body.exam_id)
    .single();

  if (examErr || !exam) return errorResponse("Examen no encontrado", 404);
  if (exam.user_id !== user.id) return errorResponse("No autorizado", 403);
  if (exam.status !== "in_progress") return errorResponse("El examen ya no está en curso", 409);

  // 2. Obtener la pregunta con su respuesta correcta y task_id (solo accesible con service_role)
  const { data: question, error: qErr } = await admin
    .from("questions")
    .select("id, correct_answer, task_id, times_answered, times_correct")
    .eq("id", body.question_id)
    .single();

  if (qErr || !question) return errorResponse("Pregunta no encontrada", 404);

  const correct = isCorrect(body.user_answer, question.correct_answer);

  // 3. Actualizar exam_items
  const { error: updateErr } = await admin
    .from("exam_items")
    .update({
      user_answer: body.user_answer,
      is_correct: correct,
      time_spent_seconds: body.time_spent_seconds ?? null,
      answered_at: new Date().toISOString(),
    })
    .eq("exam_id", body.exam_id)
    .eq("question_id", body.question_id);

  if (updateErr) return errorResponse(updateErr.message, 500);

  // 4. Telemetría agregada del ítem (detección de preguntas mal calibradas)
  await admin
    .from("questions")
    .update({
      times_answered: (question.times_answered ?? 0) + 1,
      times_correct: (question.times_correct ?? 0) + (correct ? 1 : 0),
    })
    .eq("id", question.id);

  // 5. Mastery por tarea ECO (función definida en 0005_analytics.sql)
  const { error: masteryErr } = await admin.rpc("upsert_task_mastery", {
    p_user_id: user.id,
    p_task_id: question.task_id,
    p_is_correct: correct,
  });
  if (masteryErr) return errorResponse(masteryErr.message, 500);

  // No se revela correct_answer en la respuesta salvo que el diseño de producto
  // decida dar feedback inmediato tras cada cluster; aquí se devuelve solo el resultado.
  return jsonResponse({ is_correct: correct });
});
