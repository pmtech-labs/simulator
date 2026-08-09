// Edge Function: admin_metrics
//
// GET -> dashboard de métricas de negocio en una sola llamada:
//   - summary: usuarios totales, licencias de pago activas, MRR actual, conversión global
//   - mrr_trend: MRR normalizado a mensual por periodo (semana/mes/año)
//   - signups_vs_purchases: registros vs primera compra por periodo, con % conversión
//   - sales_by_plan: ventas y facturación por plan en el rango indicado
//
// Parámetros de query: granularity (week|month|year, por defecto month),
// periods (nº de periodos hacia atrás, por defecto 12), sales_from/sales_to
// (rango para sales_by_plan, por defecto los últimos 12 meses).
//
// LIMITACIÓN DE DATOS (ver migración SQL para el detalle completo): no existe
// tabla de pagos/pedidos, todo se calcula a partir de `licenses` + `plans`
// (precio ACTUAL del plan, no el histórico realmente pagado).

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

const VALID_GRANULARITIES = ["week", "month", "year"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();
  const url = new URL(req.url);
  const granularity = url.searchParams.get("granularity") ?? "month";
  if (!VALID_GRANULARITIES.includes(granularity)) {
    return errorResponse("granularity debe ser week, month o year", 400);
  }
  const periods = Math.min(Number(url.searchParams.get("periods") ?? 12), 52);

  const salesTo = url.searchParams.get("sales_to") ?? new Date().toISOString();
  const salesFrom = url.searchParams.get("sales_from")
    ?? new Date(new Date(salesTo).setMonth(new Date(salesTo).getMonth() - 12)).toISOString();

  const [mrrTrend, signupsVsPurchases, salesByPlan, allUsersRes] = await Promise.all([
    admin.rpc("admin_mrr_trend", { p_granularity: granularity, p_periods: periods }),
    admin.rpc("admin_signups_vs_purchases", { p_granularity: granularity, p_periods: periods }),
    admin.rpc("admin_sales_by_plan", { p_from: salesFrom, p_to: salesTo }),
    admin.rpc("admin_list_users"),
  ]);

  if (mrrTrend.error) return errorResponse(mrrTrend.error.message, 500);
  if (signupsVsPurchases.error) return errorResponse(signupsVsPurchases.error.message, 500);
  if (salesByPlan.error) return errorResponse(salesByPlan.error.message, 500);
  if (allUsersRes.error) return errorResponse(allUsersRes.error.message, 500);

  const allUsers = allUsersRes.data ?? [];
  const totalUsers = allUsers.length;
  const activePaidLicenses = allUsers.filter((u: any) => u.current_plan_code && u.current_plan_code !== "free").length;

  const currentMrr = (mrrTrend.data ?? [])[mrrTrend.data!.length - 1]?.mrr_cents ?? 0;
  const totalSignups = (signupsVsPurchases.data ?? []).reduce((s: number, r: any) => s + r.signups, 0);
  const totalPurchases = (signupsVsPurchases.data ?? []).reduce((s: number, r: any) => s + r.purchases, 0);
  const overallConversionPct = totalSignups > 0 ? Math.round((totalPurchases / totalSignups) * 1000) / 10 : 0;

  return jsonResponse({
    summary: {
      total_users: totalUsers,
      active_paid_licenses: activePaidLicenses,
      current_mrr_cents: currentMrr,
      overall_conversion_pct: overallConversionPct,
    },
    mrr_trend: mrrTrend.data,
    signups_vs_purchases: signupsVsPurchases.data,
    sales_by_plan: salesByPlan.data,
    data_limitations:
      "No existe tabla de pagos/pedidos: los importes se calculan con el precio ACTUAL de cada plan (plans.price_cents), no con el precio real pagado en el momento de cada compra histórica.",
  });
});
