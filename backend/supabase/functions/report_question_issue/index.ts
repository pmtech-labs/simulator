// Edge Function: report_question_issue
//
// POST -> el candidato reporta un problema con una pregunta (enunciado confuso,
// explicación poco clara, posible error) directamente desde la práctica o la revisión
// de resultado. Se guarda en question_reports; el admin lo ve priorizado en
// v_question_stats (open_reports_count) para revisar antes de que otros candidatos
// se topen con el mismo problema.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface ReportBody {
  question_id: string;
  comment: string;
  exam_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const body: ReportBody = await req.json();
  if (!body.question_id || !body.comment?.trim()) {
    return errorResponse("Faltan campos requeridos (question_id, comment)", 400);
  }

  const admin = getSupabaseAdmin();

  const { data: question, error: qErr } = await admin
    .from("questions")
    .select("id")
    .eq("id", body.question_id)
    .maybeSingle();
  if (qErr || !question) return errorResponse("Pregunta no encontrada", 404);

  const { data, error } = await admin
    .from("question_reports")
    .insert({
      question_id: body.question_id,
      user_id: user.id,
      exam_id: body.exam_id ?? null,
      comment: body.comment.trim(),
    })
    .select("id")
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ reported: true, report_id: data.id });
});
