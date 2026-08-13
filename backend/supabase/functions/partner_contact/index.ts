// Edge Function: partner_contact
//
// POST -> recibe el formulario de contacto de la página de partners y envía un
// correo a contacto@glacimonto.com vía la API de Resend (mismo dominio ya
// verificado que usa Supabase Auth para los correos transaccionales de la app).
//
// Público (anon), sin autenticación -- es un formulario de contacto de la web
// de marketing, no una acción de usuario logueado. Protegido con:
// - Validación de campos obligatorios.
// - Honeypot simple (campo oculto "website" que un humano nunca rellena).
// - Rate limit básico por IP (tabla partner_contact_submissions).

import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface PartnerContactBody {
  nombre: string;
  empresa: string;
  email: string;
  telefono?: string;
  mensaje: string;
  website?: string; // honeypot -- debe llegar vacío
}

const CONTACT_EMAIL = "contacto@glacimonto.com";
const FROM_EMAIL = "Formulario Partners <formulario@glacimonto.com>";
const MAX_SUBMISSIONS_PER_IP_PER_DAY = 5;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  let body: PartnerContactBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Cuerpo de la petición inválido", 400);
  }

  // Honeypot: si el campo oculto viene relleno, es un bot -- respondemos 200 sin
  // hacer nada, para no darle al bot ninguna señal de que fue detectado.
  if (body.website && body.website.trim().length > 0) {
    return jsonResponse({ ok: true });
  }

  if (!body.nombre?.trim() || !body.empresa?.trim() || !body.email?.trim() || !body.mensaje?.trim()) {
    return errorResponse("Faltan campos obligatorios (nombre, empresa, email, mensaje)", 400);
  }
  if (!isValidEmail(body.email)) {
    return errorResponse("Email no válido", 400);
  }
  if (body.mensaje.length > 5000) {
    return errorResponse("Mensaje demasiado largo", 400);
  }

  const admin = getSupabaseAdmin();
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Rate limit básico: máximo N envíos por IP en 24h.
  const { count } = await admin
    .from("partner_contact_submissions")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", clientIp)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_IP_PER_DAY) {
    return errorResponse("Demasiadas solicitudes. Inténtalo de nuevo más tarde.", 429);
  }

  const resendApiKey = await admin.rpc("vault_read_resend_api_key");
  if (resendApiKey.error || !resendApiKey.data) {
    console.error("No se pudo leer la API key de Resend", resendApiKey.error);
    return errorResponse("Error interno al procesar la solicitud", 500);
  }

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const htmlBody = `
    <h2>Nueva solicitud de contacto — Partners</h2>
    <p><strong>Nombre:</strong> ${escapeHtml(body.nombre)}</p>
    <p><strong>Empresa/Organización:</strong> ${escapeHtml(body.empresa)}</p>
    <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
    ${body.telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(body.telefono)}</p>` : ""}
    <p><strong>Mensaje:</strong></p>
    <p>${escapeHtml(body.mensaje).replace(/\n/g, "<br>")}</p>
    <hr>
    <p style="color:#888;font-size:12px">Enviado desde el formulario de partners de simulador.glacimonto.com — IP: ${clientIp}</p>
  `;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey.data}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [CONTACT_EMAIL],
      reply_to: body.email,
      subject: `Nueva solicitud de partner: ${body.empresa}`,
      html: htmlBody,
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error(`Resend API error ${resendRes.status}: ${errText}`);
    return errorResponse("No se pudo enviar el mensaje. Inténtalo de nuevo en unos minutos.", 502);
  }

  await admin.from("partner_contact_submissions").insert({
    ip_address: clientIp,
    nombre: body.nombre,
    empresa: body.empresa,
    email: body.email,
  });

  return jsonResponse({ ok: true });
});
