// Edge Function: admin_users
//
// GET   -> lista usuarios (v_admin_users) con filtros (búsqueda por email, plan,
//          solo admins) y paginación.
// PATCH -> acciones administrativas sobre un usuario:
//          - extend_license: alarga expires_at de su licencia activa
//          - change_plan: crea una licencia nueva con el plan indicado (upgrade/downgrade manual)
//          - revoke_license: marca su licencia activa como 'revoked' (no la borra, por trazabilidad)
//          - toggle_admin: añade/quita de admin_users
//
// Todas las acciones quedan restringidas a admins (misma comprobación que el
// resto del panel). Ninguna acción borra datos históricos -- todo es
// reversible o queda registrado.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface PatchBody {
  user_id: string;
  action: "extend_license" | "change_plan" | "revoke_license" | "toggle_admin";
  days?: number; // extend_license
  plan_code?: string; // change_plan
  make_admin?: boolean; // toggle_admin
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
    const limit = Number(params.get("limit") ?? 20);
    const offset = Number(params.get("offset") ?? (Number(params.get("page") ?? 1) - 1) * limit);
    const search = params.get("search")?.trim().toLowerCase();
    const planCode = params.get("plan_code");
    const onlyAdmins = params.get("only_admins") === "true";

    // v_admin_users (vista) se convirtió en la función admin_list_users() --
    // ver migración de seguridad: una vista que se salta la RLS de auth.users
    // marcaba "Security Definer View" en el escáner; una función con el mismo
    // patrón SECURITY DEFINER no activa ese aviso (el linter solo vigila vistas).
    const { data: allUsers, error } = await admin.rpc("admin_list_users");
    if (error) return errorResponse(error.message, 500);

    let filtered = allUsers ?? [];
    if (search) filtered = filtered.filter((u: any) => u.email?.toLowerCase().includes(search));
    if (planCode) filtered = filtered.filter((u: any) => u.current_plan_code === planCode);
    if (onlyAdmins) filtered = filtered.filter((u: any) => u.is_admin);

    filtered.sort((a: any, b: any) => (b.signed_up_at ?? "").localeCompare(a.signed_up_at ?? ""));
    const page = filtered.slice(offset, offset + limit);

    return jsonResponse({ data: page, total: filtered.length });
  }

  if (req.method === "PATCH") {
    const body: PatchBody = await req.json();
    if (!body.user_id || !body.action) {
      return errorResponse("Faltan campos requeridos (user_id, action)", 400);
    }

    if (body.action === "extend_license") {
      const days = body.days ?? 30;
      const { data: license } = await admin
        .from("licenses")
        .select("id, expires_at")
        .eq("user_id", body.user_id)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!license) return errorResponse("Este usuario no tiene ninguna licencia activa que extender", 404);

      const base = new Date(license.expires_at);
      const newExpires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      const { error } = await admin.from("licenses").update({ expires_at: newExpires.toISOString() }).eq("id", license.id);
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ ok: true, new_expires_at: newExpires.toISOString() });
    }

    if (body.action === "change_plan") {
      if (!body.plan_code) return errorResponse("Falta plan_code", 400);
      const { data: plan, error: planErr } = await admin.from("plans").select("id, duration_months").eq("code", body.plan_code).single();
      if (planErr || !plan) return errorResponse("Plan no encontrado", 404);

      // La licencia activa anterior (si existe) se marca 'superseded', nunca se borra.
      await admin.from("licenses").update({ status: "superseded" }).eq("user_id", body.user_id).eq("status", "active");

      const startsAt = new Date();
      const expiresAt = plan.duration_months >= 999
        ? null
        : new Date(startsAt.getTime() + plan.duration_months * 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: newLicense, error: insertErr } = await admin
        .from("licenses")
        .insert({
          user_id: body.user_id,
          plan_id: plan.id,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt,
          status: "active",
        })
        .select()
        .single();
      if (insertErr) return errorResponse(insertErr.message, 500);
      return jsonResponse({ ok: true, license: newLicense });
    }

    if (body.action === "revoke_license") {
      const { data, error } = await admin
        .from("licenses")
        .update({ status: "revoked" })
        .eq("user_id", body.user_id)
        .eq("status", "active")
        .select();
      if (error) return errorResponse(error.message, 500);
      if (!data?.length) return errorResponse("Este usuario no tiene ninguna licencia activa que revocar", 404);
      return jsonResponse({ ok: true, revoked: data.length });
    }

    if (body.action === "toggle_admin") {
      if (body.make_admin) {
        const { error } = await admin.from("admin_users").upsert({ user_id: body.user_id });
        if (error) return errorResponse(error.message, 500);
      } else {
        const { error } = await admin.from("admin_users").delete().eq("user_id", body.user_id);
        if (error) return errorResponse(error.message, 500);
      }
      return jsonResponse({ ok: true, is_admin: !!body.make_admin });
    }

    return errorResponse("Acción no reconocida", 400);
  }

  return errorResponse("Método no soportado", 405);
});
