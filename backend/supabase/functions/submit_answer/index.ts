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
import { computeRemainingSeconds } from "../_shared/examTimer.ts";

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
  if (!body.exam_id || !body.question_id || !Array.isArray(body.user_answer)) {
    return errorResponse("Faltan campos requeridos (exam_id, question_id, user_answer como array)", 400);
  }
  const admin = getSupabaseAdmin();

  const { data: exam, error: examErr } = await admin
    .from("exams")
    .select("id, user_id, status, mode, time_limit_seconds, started_at, paused_at, break_extension_seconds")
    .eq("id", body.exam_id)
    .single();

  if (examErr || !exam) return errorResponse("Examen no encontrado", 404);
  if (exam.user_id !== user.id) return errorResponse("No autorizado", 403);
  if (exam.status !== "in_progress") return errorResponse("El examen ya no está en curso", 409);

  // R6: "Una vez cierres una sección, no podrás volver a cambiar sus respuestas."
  // BUG encontrado en auditoría (ago 2026): esto solo lo bloqueaba la navegación del
  // frontend (botones deshabilitados) -- el backend aceptaba sin más una respuesta a
  // una pregunta de una sección ya finalizada, permitiendo cambiar respuestas "cerradas"
  // con una llamada directa a la API. Se verifica aquí el status real de la sección en
  // exam_sections antes de aceptar la respuesta. Solo aplica a full_sim, que es el único
  // modo con secciones reales (R5); el resto de modos no tiene este concepto.
  if (exam.mode === "full_sim") {
    const { data: item } = await admin
      .from("exam_items")
      .select("section_number")
      .eq("exam_id", body.exam_id)
      .eq("question_id", body.question_id)
      .maybeSingle();

    if (item?.section_number) {
      const { data: section } = await admin
        .from("exam_sections")
        .select("status")
        .eq("exam_id", body.exam_id)
        .eq("section_number", item.section_number)
        .maybeSingle();

      if (section?.status === "completed") {
        return errorResponse("Esta sección ya está cerrada, no se pueden modificar sus respuestas.", 409);
      }
    }
  }

  // R6: "Si el reloj principal llega a 00:00, el examen finaliza de forma inmediata."
  // No se puntúa aquí (responsabilidad de finish_exam) -- se bloquea la respuesta y se
  // informa al frontend para que llame a finish_exam de inmediato. Solo aplica al
  // reloj global de full_sim (los demás modos no tienen límite de tiempo estricto).
  if (exam.mode === "full_sim") {
    const remaining = computeRemainingSeconds(exam);
    if (remaining !== null && remaining <= 0 && !exam.paused_at) {
      return errorResponse("Se agotó el tiempo del examen. Debe finalizarse.", 409);
    }
  }

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
