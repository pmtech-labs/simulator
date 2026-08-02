// Edge Function: provision_free_license
//
// POST -> se llama justo después de que un candidato se registra (supabase.auth.signUp).
// Crea automáticamente una licencia del plan 'free' para el usuario autenticado, sin
// pasar por Stripe ni por ningún flujo de pago. Idempotente: si el usuario ya tiene
// una licencia activa (de cualquier plan), no hace nada y lo informa.
//
// El plan free da acceso a práctica por dominio/lección/acumulativo sin límite de
// tiempo, y a UN simulacro completo (full_sim) de regalo -- controlado por
// licenses.free_full_sim_used, no por un cronómetro de sesión.

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
      free_full_sim_used: false,
    })
    .select("id, expires_at")
    .single();

  if (insertErr) return errorResponse(insertErr.message, 500);
  return jsonResponse({ created: true, license });
});
