// Edge Function: subscribe_newsletter
//
// POST -> se llama cuando el usuario marca la casilla de consentimiento del boletín
// durante el registro. Hace dos cosas:
//  1. Guarda el consentimiento en newsletter_subscribers (nuestra base de verdad,
//     con marca de tiempo y origen -- necesario para poder demostrar el consentimiento
//     ante una auditoría RGPD).
//  2. Da de alta el contacto en Resend (Audiences/Contacts API), para poder enviar
//     campañas y avisos desde ahí.
//
// Substack NO se sincroniza aquí: no tiene API pública de suscripción (confirmado en
// julio 2026 -- su "Developer API" es solo de búsqueda de perfiles, no de gestión de
// suscriptores). La sincronización con Substack se hace por un mecanismo aparte
// (exportación CSV periódica o widget embebido, pendiente de decidir), marcado en
// synced_to_substack_at cuando corresponda.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface SubscribeBody {
  email: string;
  full_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  // No exigimos admin, pero sí una sesión válida -- este endpoint se llama justo
  // después del registro, con el usuario ya autenticado.
  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const body: SubscribeBody = await req.json();
  if (!body.email) return errorResponse("Falta el campo email", 400);

  const admin = getSupabaseAdmin();

  const { data: subscriber, error: upsertErr } = await admin
    .from("newsletter_subscribers")
    .upsert(
      {
        email: body.email,
        full_name: body.full_name ?? null,
        source: "registro",
        status: "subscribed",
      },
      { onConflict: "email" },
    )
    .select("id, email, full_name")
    .single();

  if (upsertErr) return errorResponse(upsertErr.message, 500);

  // Alta en Resend (Contacts API). Si falla, no bloqueamos el registro del usuario --
  // se puede reintentar/reconciliar después; lo importante es que el consentimiento
  // ya quedó guardado en nuestra propia tabla.
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendAudienceId = Deno.env.get("RESEND_NEWSLETTER_AUDIENCE_ID");
  let resendSynced = false;

  if (resendApiKey && resendAudienceId) {
    try {
      const [firstName, ...rest] = (body.full_name ?? "").split(" ");
      const res = await fetch("https://api.resend.com/contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: body.email,
          first_name: firstName || undefined,
          last_name: rest.join(" ") || undefined,
          unsubscribed: false,
          audience_id: resendAudienceId,
        }),
      });
      resendSynced = res.ok;
      if (!res.ok) console.error("Error al dar de alta en Resend:", await res.text());
    } catch (err) {
      console.error("Excepción al llamar a Resend:", err);
    }
  } else {
    console.error("RESEND_API_KEY o RESEND_NEWSLETTER_AUDIENCE_ID no configurados");
  }

  if (resendSynced) {
    await admin
      .from("newsletter_subscribers")
      .update({ synced_to_resend_at: new Date().toISOString() })
      .eq("id", subscriber.id);
  }

  return jsonResponse({ subscribed: true, resend_synced: resendSynced, subscriber_id: subscriber.id });
});
