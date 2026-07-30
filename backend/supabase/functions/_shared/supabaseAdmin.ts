import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Usa SIEMPRE la service_role key dentro de Edge Functions (nunca se expone al cliente).
// Las variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase
// automáticamente en runtime; no hace falta configurarlas manualmente salvo en local.
export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// Extrae el usuario autenticado a partir del JWT que llega en el header Authorization,
// verificándolo contra Supabase Auth (no confiar nunca en un user_id enviado en el body).
export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const jwt = authHeader.replace("Bearer ", "");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user;
}
