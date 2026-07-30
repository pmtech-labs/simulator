// Edge Function: stripe_webhook
//
// Recibe eventos de Stripe (checkout.session.completed, customer.subscription.deleted)
// y crea/actualiza filas en `licenses`. Configura este endpoint en el dashboard de Stripe
// apuntando a: https://<project-ref>.supabase.co/functions/v1/stripe_webhook
//
// Variables de entorno requeridas (Supabase secrets):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SIGNING_SECRET

import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error("Firma de webhook inválida:", err);
    return new Response("Firma inválida", { status: 400 });
  }

  const admin = getSupabaseAdmin();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id; // debe enviarse desde el frontend al crear el Checkout
      const planCode = session.metadata?.plan_code; // 'basica_3m' | 'premium_6m'

      if (!userId || !planCode) {
        console.error("checkout.session.completed sin client_reference_id o plan_code en metadata");
        break;
      }

      const { data: plan, error: planErr } = await admin
        .from("plans")
        .select("id, duration_months")
        .eq("code", planCode)
        .single();

      if (planErr || !plan) {
        console.error("Plan no encontrado para code:", planCode);
        break;
      }

      const startsAt = new Date();
      const expiresAt = new Date(startsAt);
      expiresAt.setMonth(expiresAt.getMonth() + plan.duration_months);

      await admin.from("licenses").insert({
        user_id: userId,
        plan_id: plan.id,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "active",
        stripe_subscription_id: session.subscription as string ?? null,
        stripe_customer_id: session.customer as string ?? null,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await admin
        .from("licenses")
        .update({ status: "cancelled" })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    default:
      // Otros eventos no requieren acción por ahora.
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
