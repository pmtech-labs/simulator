// Edge Function: expire_licenses
//
// Pensada para invocarse por cron (Supabase Scheduled Functions / pg_cron), p. ej. cada hora:
//   select cron.schedule('expire-licenses-hourly', '0 * * * *',
//     $$ select net.http_post(url:='https://<project-ref>.supabase.co/functions/v1/expire_licenses') $$);
//
// 1. Marca como 'expired' las licencias cuya expires_at ya pasó.
// 2. Para cada licencia recién expirada, calcula si el usuario tuvo mastery bajo
//    en Business Environment (el dominio que más pesa el ECO 2026 y donde más se falla
//    por estudiar con material desactualizado) y deja una fila en `retargeting_signals`
//    para que la herramienta de email (MailerLite/Brevo) dispare la campaña de recompra.

import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

const BUSINESS_ENVIRONMENT_MASTERY_THRESHOLD = 60; // %

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = getSupabaseAdmin();

  const { data: expiring, error: findErr } = await admin
    .from("licenses")
    .select("id, user_id")
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());

  if (findErr) return errorResponse(findErr.message, 500);
  if (!expiring || expiring.length === 0) {
    return jsonResponse({ expired_count: 0 });
  }

  const ids = expiring.map((l) => l.id);
  const { error: updateErr } = await admin
    .from("licenses")
    .update({ status: "expired" })
    .in("id", ids);
  if (updateErr) return errorResponse(updateErr.message, 500);

  let signalsCreated = 0;
  for (const license of expiring) {
    const { data: mastery, error: masteryErr } = await admin
      .from("user_task_mastery")
      .select("mastery_pct, eco_tasks(eco_domains(code))")
      .eq("user_id", license.user_id);

    if (masteryErr) continue;

    const beRows = (mastery ?? []).filter(
      (m: any) => m.eco_tasks?.eco_domains?.code === "business_environment",
    );
    if (beRows.length === 0) continue;

    const avgBe =
      beRows.reduce((sum: number, r: any) => sum + Number(r.mastery_pct), 0) / beRows.length;

    if (avgBe < BUSINESS_ENVIRONMENT_MASTERY_THRESHOLD) {
      await admin.from("retargeting_signals").insert({
        user_id: license.user_id,
        reason: "low_business_environment_mastery_on_expiry",
        detail: { avg_business_environment_mastery: avgBe },
      });
      signalsCreated++;
    }
  }

  return jsonResponse({ expired_count: expiring.length, retargeting_signals_created: signalsCreated });
});
