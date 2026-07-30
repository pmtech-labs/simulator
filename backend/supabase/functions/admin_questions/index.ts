// Edge Function: admin_questions
//
// PATCH  -> cambia el status de una o varias preguntas (in_review -> approved -> published,
//           o -> retired para sacarla del pool de selección sin borrar histórico).
// DELETE -> borrado físico, permitido ÚNICAMENTE si la pregunta nunca ha sido usada en
//           ningún examen (exam_items). Si ya se usó, se fuerza a 'retired' en su lugar
//           y se informa por qué, para no romper la trazabilidad de exámenes ya realizados.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface UpdateStatusBody {
  question_ids: string[];
  status: "in_review" | "approved" | "published" | "retired";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();

  if (req.method === "PATCH") {
    const body: UpdateStatusBody = await req.json();
    if (!body.question_ids?.length || !body.status) {
      return errorResponse("Faltan campos requeridos (question_ids, status)", 400);
    }

    const updatePayload: Record<string, unknown> = { status: body.status };
    if (body.status === "approved" || body.status === "published") {
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = new Date().toISOString();
    }

    const { data, error } = await admin
      .from("questions")
      .update(updatePayload)
      .in("id", body.question_ids)
      .select("id, status");

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ updated: data });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const questionId = url.searchParams.get("id");
    if (!questionId) return errorResponse("Falta el parámetro id", 400);

    const { count, error: usageErr } = await admin
      .from("exam_items")
      .select("id", { count: "exact", head: true })
      .eq("question_id", questionId);

    if (usageErr) return errorResponse(usageErr.message, 500);

    if (count && count > 0) {
      // Ya se usó en exámenes reales: no se borra, se retira para no romper trazabilidad.
      const { error: retireErr } = await admin
        .from("questions")
        .update({ status: "retired" })
        .eq("id", questionId);
      if (retireErr) return errorResponse(retireErr.message, 500);
      return jsonResponse({
        deleted: false,
        retired: true,
        reason: `La pregunta se usó en ${count} examen(es); se marcó como 'retired' en lugar de borrarla, para no romper el histórico de resultados.`,
      });
    }

    const { error: deleteErr } = await admin.from("questions").delete().eq("id", questionId);
    if (deleteErr) return errorResponse(deleteErr.message, 500);
    return jsonResponse({ deleted: true, retired: false });
  }

  return errorResponse("Método no soportado", 405);
});
