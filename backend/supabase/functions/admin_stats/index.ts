// Edge Function: admin_stats
//
// GET /admin_stats?view=hardest_questions   -> preguntas con menor success_rate_pct (más falladas)
// GET /admin_stats?view=most_used_questions -> preguntas con más times_used_in_exams
// GET /admin_stats?view=coverage            -> cobertura del banco por tarea ECO (v_task_coverage)
// GET /admin_stats?view=exams               -> resumen de exámenes realizados (v_exam_stats)

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();
  const view = new URL(req.url).searchParams.get("view") ?? "coverage";

  switch (view) {
    case "hardest_questions": {
      const { data, error } = await admin
        .from("v_question_stats")
        .select("*")
        .not("success_rate_pct", "is", null)
        .order("success_rate_pct", { ascending: true })
        .limit(50);
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ view, data });
    }

    case "most_used_questions": {
      const { data, error } = await admin
        .from("v_question_stats")
        .select("*")
        .order("times_used_in_exams", { ascending: false })
        .limit(50);
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ view, data });
    }

    case "coverage": {
      const { data, error } = await admin.from("v_task_coverage").select("*");
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ view, data });
    }

    case "exams": {
      const { data, error } = await admin.from("v_exam_stats").select("*");
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ view, data });
    }

    default:
      return errorResponse(`Vista no soportada: ${view}`, 400);
  }
});
