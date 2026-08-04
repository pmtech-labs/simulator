// Edge Function: exam_section_control
//
// Gestiona 2 acciones sobre el reloj único global del examen (R6/R7):
//
// action="finalize_section" -> el candidato pulsó "Finalizar sección" en la Pantalla
//   de Revisión (R6). Cierra el bloque actual PERMANENTEMENTE (status='completed',
//   sin acceso posterior) y abre el siguiente. Si era el bloque 3, el examen queda
//   listo para llamar a finish_exam (no se puntúa aquí, esa lógica sigue en
//   finish_exam, sin duplicarla).
//
// action="start_break" -> descanso opcional de 10 min tras el bloque 1 o el bloque 2
//   (R7). Congela el reloj principal (exams.paused_at). Máximo 2 descansos por examen.
//
// action="resume_break" -> el candidato reanuda. Se calcula cuánto duró la pausa: se
//   le "devuelven" como máximo 600s al reloj principal (break_extension_seconds) --
//   el exceso sobre 10 min queda sin devolver, así se descuenta solo del principal.
//
// Todas las respuestas devuelven el estado autoritativo del reloj (remaining_seconds,
// paused) para que el frontend sincronice su cuenta atrás local en cada transición.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { computeRemainingSeconds } from "../_shared/examTimer.ts";

interface Body {
  exam_id: string;
  action: "finalize_section" | "start_break" | "resume_break";
  section_number?: number; // requerido para finalize_section
}

const MAX_BREAKS = 2; // tras bloque 1 y tras bloque 2 -- nunca tras el bloque 3 (fin de examen)
const BREAK_ALLOWANCE_SECONDS = 600;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const body: Body = await req.json();
  if (!body.exam_id || !body.action) return errorResponse("Faltan campos requeridos (exam_id, action)", 400);

  const admin = getSupabaseAdmin();

  const { data: exam, error: examErr } = await admin
    .from("exams")
    .select("id, user_id, status, mode, time_limit_seconds, started_at, paused_at, break_extension_seconds, breaks_used")
    .eq("id", body.exam_id)
    .single();

  if (examErr || !exam) return errorResponse("Examen no encontrado", 404);
  if (exam.user_id !== user.id) return errorResponse("No autorizado", 403);
  if (exam.status !== "in_progress") return errorResponse("El examen ya no está en curso", 409);
  if (exam.mode !== "full_sim") return errorResponse("Esta acción solo aplica a simulacros completos (R6/R7)", 400);

  const remainingNow = computeRemainingSeconds(exam);
  if (remainingNow !== null && remainingNow <= 0 && exam.paused_at === null) {
    // R6: "Si el reloj principal llega a 00:00, el examen finaliza de forma
    // inmediata." No se puntúa aquí (eso es responsabilidad de finish_exam) -- se
    // informa al frontend para que lo llame de inmediato.
    return errorResponse("Se agotó el tiempo del examen. Debe finalizarse.", 409);
  }

  if (body.action === "finalize_section") {
    if (!body.section_number) return errorResponse("Falta section_number", 400);
    if (exam.paused_at) return errorResponse("No se puede finalizar una sección durante un descanso", 409);

    const { data: currentSection, error: sectionErr } = await admin
      .from("exam_sections")
      .select("id, section_number, status")
      .eq("exam_id", body.exam_id)
      .eq("section_number", body.section_number)
      .single();
    if (sectionErr || !currentSection) return errorResponse("Sección no encontrada", 404);
    if (currentSection.status === "completed") return errorResponse("Esta sección ya estaba finalizada", 409);
    if (currentSection.status !== "in_progress") return errorResponse("Esta sección no es la sección activa", 409);

    const { error: closeErr } = await admin
      .from("exam_sections")
      .update({ status: "completed", finished_at: new Date().toISOString() })
      .eq("id", currentSection.id);
    if (closeErr) return errorResponse(closeErr.message, 500);

    const { data: nextSection } = await admin
      .from("exam_sections")
      .select("id, section_number")
      .eq("exam_id", body.exam_id)
      .eq("section_number", body.section_number + 1)
      .maybeSingle();

    let examComplete = false;
    if (nextSection) {
      await admin
        .from("exam_sections")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", nextSection.id);
    } else {
      // No hay bloque siguiente -- se acaban de completar las 180 preguntas.
      examComplete = true;
    }

    return jsonResponse({
      section_closed: body.section_number,
      next_section: nextSection?.section_number ?? null,
      exam_complete: examComplete,
      remaining_seconds: computeRemainingSeconds(exam),
      paused: false,
    });
  }

  if (body.action === "start_break") {
    if (exam.paused_at) return errorResponse("Ya hay un descanso en curso", 409);
    if ((exam.breaks_used ?? 0) >= MAX_BREAKS) {
      return errorResponse("Ya se han usado los 2 descansos disponibles", 409);
    }

    const { error: pauseErr } = await admin
      .from("exams")
      .update({ paused_at: new Date().toISOString() })
      .eq("id", body.exam_id);
    if (pauseErr) return errorResponse(pauseErr.message, 500);

    return jsonResponse({
      paused: true,
      remaining_seconds: computeRemainingSeconds(exam),
      break_allowance_seconds: BREAK_ALLOWANCE_SECONDS,
    });
  }

  if (body.action === "resume_break") {
    if (!exam.paused_at) return errorResponse("No hay ningún descanso en curso", 409);

    const pauseDurationSeconds = Math.round((Date.now() - new Date(exam.paused_at).getTime()) / 1000);
    // Nunca se devuelven más de 600s al reloj principal, sea cual sea la duración
    // real del descanso -- así el exceso sobre 10 min se descuenta solo (R7).
    const extension = Math.min(Math.max(0, pauseDurationSeconds), BREAK_ALLOWANCE_SECONDS);

    const { error: resumeErr } = await admin
      .from("exams")
      .update({
        paused_at: null,
        break_extension_seconds: (exam.break_extension_seconds ?? 0) + extension,
        breaks_used: (exam.breaks_used ?? 0) + 1,
      })
      .eq("id", body.exam_id);
    if (resumeErr) return errorResponse(resumeErr.message, 500);

    const updatedExam = {
      ...exam,
      paused_at: null,
      break_extension_seconds: (exam.break_extension_seconds ?? 0) + extension,
    };

    return jsonResponse({
      paused: false,
      break_duration_seconds: pauseDurationSeconds,
      credited_seconds: extension,
      overage_seconds: Math.max(0, pauseDurationSeconds - BREAK_ALLOWANCE_SECONDS),
      remaining_seconds: computeRemainingSeconds(updatedExam),
    });
  }

  return errorResponse("Acción no reconocida", 400);
});
