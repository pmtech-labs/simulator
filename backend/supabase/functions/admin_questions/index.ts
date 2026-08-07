// Edge Function: admin_questions
//
// GET    -> lista preguntas para la cola de revisión, con filtros (status, domain_code, task_id,
//           approach, job_id, min_times_used, max_success_rate) y paginación. Usa v_question_stats,
//           que ya trae el contenido completo + estadísticas agregadas en una sola vista.
// PATCH  -> cambia el status de una o varias preguntas (draft -> published, o -> retired para
//           sacarla del pool de selección sin borrar histórico). Simplificado de 5 a 3 estados:
//           in_review y approved no tenían ninguna lógica funcional distinta de draft/published,
//           eran papeleo sin efecto real -- se quitaron.
// DELETE -> borrado físico, permitido ÚNICAMENTE si la pregunta nunca ha sido usada en
//           ningún examen (exam_items). Si ya se usó, se fuerza a 'retired' en su lugar
//           y se informa por qué, para no romper la trazabilidad de exámenes ya realizados.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface UpdateStatusBody {
  question_ids: string[];
  status: "draft" | "published" | "retired";
  // Motivo de rechazo (obligatorio en la práctica cuando status="retired" viene del
  // flujo de revisión del PO, aunque no se fuerza aquí para no romper el fallback
  // automático de DELETE, que retira sin motivo cuando la pregunta ya se usó en un examen).
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const params = url.searchParams;
    const limit = Number(params.get("limit") ?? params.get("page_size") ?? 20);
    const offset = Number(params.get("offset") ?? (Number(params.get("page") ?? 1) - 1) * limit);

    let query = admin
      .from("v_question_stats")
      .select("*", { count: "exact" });

    const statusParam = params.get("status");
    if (statusParam) query = query.in("status", statusParam.split(",").filter(Boolean));

    const domainCode = params.get("domain_code");
    if (domainCode) query = query.eq("domain_code", domainCode);

    const taskId = params.get("task_id");
    if (taskId) query = query.eq("task_id", taskId);

    const approach = params.get("approach");
    if (approach) query = query.eq("approach", approach);

    const processGroup = params.get("process_group");
    if (processGroup) query = query.eq("process_group", processGroup);

    const performanceDomain = params.get("performance_domain");
    if (performanceDomain) query = query.eq("performance_domain", performanceDomain);

    // Nueva taxonomía del PO (Excel Etiquetas_preguntas_simulador_PMP): filtro por
    // cualquier código de etiqueta (ej. tag_code=AEMC, tag_code=DDRI) -- funciona para
    // los 6 tipos (DO/CI/AE/DD/FO/NT) porque tag_codes es un array con TODOS los
    // códigos de la pregunta. Admite varios valores separados por coma (AND: la
    // pregunta debe tener TODOS los códigos indicados).
    const tagCodesParam = params.get("tag_code");
    if (tagCodesParam) {
      const codes = tagCodesParam.split(",").map((c) => c.trim()).filter(Boolean);
      if (codes.length > 0) query = query.contains("tag_codes", codes);
    }

    const jobId = params.get("job_id");
    if (jobId) query = query.eq("generation_job_id", jobId);

    const minTimesUsed = params.get("min_times_used");
    if (minTimesUsed) query = query.gte("times_used_in_exams", Number(minTimesUsed));

    const maxSuccessRate = params.get("max_success_rate");
    if (maxSuccessRate) query = query.lte("success_rate_pct", Number(maxSuccessRate));

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return errorResponse(error.message, 500);

    // Mapear question_id -> id para que coincida con el tipo AdminQuestion del frontend.
    const rows = (data ?? []).map((r: any) => ({ ...r, id: r.question_id }));
    return jsonResponse({ data: rows, total: count ?? rows.length });
  }

  if (req.method === "PATCH") {
    const body: UpdateStatusBody = await req.json();
    if (!body.question_ids?.length || !body.status) {
      return errorResponse("Faltan campos requeridos (question_ids, status)", 400);
    }

    const updatePayload: Record<string, unknown> = { status: body.status };
    if (body.status === "published") {
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = new Date().toISOString();
    }

    const { data, error } = await admin
      .from("questions")
      .update(updatePayload)
      .in("id", body.question_ids)
      .select("id, status");

    if (error) return errorResponse(error.message, 500);

    // Petición del PO: al retirar una pregunta durante la revisión de calidad, guardar
    // el motivo en question_rejections -- alimenta la generación futura para no repetir
    // los mismos errores (ver _shared/rejectionContext.ts, usado por los generadores).
    if (body.status === "retired" && body.reason?.trim()) {
      const { data: retiredQuestions } = await admin
        .from("questions")
        .select("id, question_number, task_id, format, stem")
        .in("id", body.question_ids);

      if (retiredQuestions?.length) {
        const rejectionRows = retiredQuestions.map((q: any) => ({
          question_id: q.id,
          question_number: q.question_number,
          task_id: q.task_id,
          format: q.format,
          stem_snapshot: q.stem,
          reason: body.reason!.trim(),
          rejected_by: user.id,
        }));
        const { error: rejectionErr } = await admin.from("question_rejections").insert(rejectionRows);
        if (rejectionErr) return errorResponse(rejectionErr.message, 500);
      }
    }

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
