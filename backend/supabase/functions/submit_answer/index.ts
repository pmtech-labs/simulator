// Edge Function: submit_answer
//
// Corrige una respuesta, actualiza exam_items, la telemetría agregada del ítem
// (questions.times_answered/times_correct), el mastery por tarea ECO del usuario, y el
// patrón de tipo de error (user_error_type_stats) cuando la respuesta es incorrecta.
//
// Feedback inmediato: SOLO en modos formativos (domain_drill, case_only, custom). En full_sim
// no se revela is_correct/explanation hasta finish_exam, replicando la presión real del examen
// (ver SIMULADOR PMP - VISIÓN GENERAL.docx: "en los simulacros realistas, las respuestas y
// explicaciones permanecen ocultas hasta finalizar").

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface SubmitAnswerBody {
  exam_id: string;
  question_id: string;
  user_answer: string[];
  time_spent_seconds?: number;
}

function isCorrect(userAnswer: unknown, correctAnswer: unknown): boolean {
  if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
    const a = [...userAnswer].sort();
    const b = [...correctAnswer].sort();
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
}

// Determina el error_type representativo cuando la respuesta es incorrecta, buscando en
// options el primer id elegido por el usuario que no es la respuesta correcta.
function findErrorType(userAnswer: string[], options: any[]): string | null {
  for (const chosenId of userAnswer) {
    const option = options.find((o: any) => o.id === chosenId);
    if (option?.error_type) return option.error_type;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const body: SubmitAnswerBody = await req.json();
  const admin = getSupabaseAdmin();

  const { data: exam, error: examErr } = await admin
    .from("exams")
    .select("id, user_id, status, mode")
    .eq("id", body.exam_id)
    .single();

  if (examErr || !exam) return errorResponse("Examen no encontrado", 404);
  if (exam.user_id !== user.id) return errorResponse("No autorizado", 403);
  if (exam.status !== "in_progress") return errorResponse("El examen ya no está en curso", 409);

  const { data: question, error: qErr } = await admin
    .from("questions")
    .select("id, correct_answer, explanation, options, task_id, times_answered, times_correct")
    .eq("id", body.question_id)
    .single();

  if (qErr || !question) return errorResponse("Pregunta no encontrada", 404);

  const correct = isCorrect(body.user_answer, question.correct_answer);
  const errorType = correct ? null : findErrorType(body.user_answer, question.options as any[]);

  const { error: updateErr } = await admin
    .from("exam_items")
    .update({
      user_answer: body.user_answer,
      is_correct: correct,
      error_type_chosen: errorType,
      time_spent_seconds: body.time_spent_seconds ?? null,
      answered_at: new Date().toISOString(),
    })
    .eq("exam_id", body.exam_id)
    .eq("question_id", body.question_id);

  if (updateErr) return errorResponse(updateErr.message, 500);

  await admin
    .from("questions")
    .update({
      times_answered: (question.times_answered ?? 0) + 1,
      times_correct: (question.times_correct ?? 0) + (correct ? 1 : 0),
    })
    .eq("id", question.id);

  const { error: masteryErr } = await admin.rpc("upsert_task_mastery", {
    p_user_id: user.id,
    p_task_id: question.task_id,
    p_is_correct: correct,
  });
  if (masteryErr) return errorResponse(masteryErr.message, 500);

  if (errorType) {
    await admin.rpc("record_error_type", { p_user_id: user.id, p_error_type: errorType });
  }

  // Feedback inmediato SOLO en modos formativos; full_sim solo confirma que se guardó.
  const isFormative = exam.mode !== "full_sim";
  if (isFormative) {
    return jsonResponse({
      is_correct: correct,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      error_type: errorType,
    });
  }

  return jsonResponse({ saved: true });
});
