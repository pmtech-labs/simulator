// Edge Function: provision_free_license
//
// POST -> se llama justo después de que un candidato se registra (supabase.auth.signUp).
// Crea automáticamente una licencia del plan 'free' para el usuario autenticado, sin
// pasar por Stripe ni por ningún flujo de pago. Idempotente: si el usuario ya tiene
// una licencia activa (de cualquier plan), no hace nada y lo informa.
//
// El plan free da acceso a práctica por dominio/lección/acumulativo sin límite de
// tiempo, y a UN medio examen (half_sim, 90 preguntas/2h) de regalo -- controlado por
// licenses.free_half_sim_used, no por un cronómetro de sesión. El simulacro completo
// (full_sim, 180 preguntas) NUNCA está incluido en este plan, ni una vez -- ver el
// bloqueo explícito en start_exam (decisión de negocio: es el mayor gancho de
// conversión y regalarlo entero desincentiva la compra). La columna
// free_full_sim_used es vestigial (de un diseño anterior) y no se usa en ningún
// punto de la lógica real -- no confundir con free_half_sim_used, que sí es real.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const admin = getSupabaseAdmin();

  const { data: existing, error: existingErr } = await admin
    .from("licenses")
    .select("id, status, expires_at, plans(code)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (existingErr) return errorResponse(existingErr.message, 500);
  if (existing) {
    return jsonResponse({ created: false, reason: "Ya tiene una licencia activa", plan_code: (existing as any).plans?.code });
  }

  const { data: freePlan, error: planErr } = await admin
    .from("plans")
    .select("id, duration_months")
    .eq("code", "free")
    .single();

  if (planErr || !freePlan) return errorResponse("Plan gratuito no configurado", 500);

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + freePlan.duration_months);

  const { data: license, error: insertErr } = await admin
    .from("licenses")
    .insert({
      user_id: user.id,
      plan_id: freePlan.id,
      status: "active",
      expires_at: expiresAt.toISOString(),
      free_half_sim_used: false,
    })
    .select("id, expires_at")
    .single();

  if (insertErr) return errorResponse(insertErr.message, 500);
  return jsonResponse({ created: true, license });
});
