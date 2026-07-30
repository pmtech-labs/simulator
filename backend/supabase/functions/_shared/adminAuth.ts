import { getSupabaseAdmin } from "./supabaseAdmin.ts";

// Verifica contra la tabla admin_users (no confía en claims del JWT, que podrían
// quedar desactualizados si se revoca el rol a alguien).
export async function requireAdmin(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}
