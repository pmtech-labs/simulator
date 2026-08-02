// Edge Function: export_newsletter_subscribers
//
// GET -> devuelve un CSV (email,full_name) de los suscriptores del boletín que
// consintieron y todavía no se han exportado (synced_to_substack_at IS NULL). Pensado
// para uso semanal: antes de mandar el boletín, el admin descarga este CSV y lo importa
// manualmente en Substack (Settings > Subscribers > Import) -- es la única vía real hoy,
// ya que Substack no tiene API pública de suscripción.
//
// Tras generar el CSV, marca esos registros como exportados (synced_to_substack_at =
// ahora) para que la siguiente exportación semanal solo incluya los nuevos desde la
// última vez -- evita duplicar altas en Substack semana a semana.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, errorResponse } from "../_shared/cors.ts";

function toCsv(rows: { email: string; full_name: string | null }[]): string {
  const header = "email,full_name";
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) => `${escape(r.email)},${escape(r.full_name ?? "")}`);
  return [header, ...lines].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();

  const { data: pending, error } = await admin
    .from("newsletter_subscribers")
    .select("id, email, full_name")
    .eq("status", "subscribed")
    .is("synced_to_substack_at", null)
    .order("created_at", { ascending: true });

  if (error) return errorResponse(error.message, 500);

  const rows = pending ?? [];
  const csv = toCsv(rows);

  if (rows.length > 0) {
    await admin
      .from("newsletter_subscribers")
      .update({ synced_to_substack_at: new Date().toISOString() })
      .in("id", rows.map((r: any) => r.id));
  }

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nuevos_suscriptores_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
