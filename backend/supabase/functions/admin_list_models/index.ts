// Edge Function: admin_list_models
//
// POST -> dado un proveedor y una API key (que el admin acaba de teclear, todavía
// sin guardar), consulta en vivo la lista de modelos disponibles de ese proveedor
// y la devuelve. Pensado para poblar el desplegable de modelo en el formulario de
// alta de conectores, en vez de dejar que el admin escriba un model_id a mano
// (causa real de un fallo anterior: se creó un conector con model_id="GPT-5",
// que no existe).
//
// La API key viaja en el body de esta petición pero NUNCA se persiste aquí — solo
// se usa para la llamada de consulta y se descarta al terminar la función.

import { getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { listModels } from "../_shared/llmProviders.ts";

interface ListModelsBody {
  provider: "anthropic" | "openai" | "openai_compatible" | "google";
  api_key: string;
  api_base_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const body: ListModelsBody = await req.json();
  if (!body.provider || !body.api_key) {
    return errorResponse("Faltan campos requeridos (provider, api_key)", 400);
  }

  try {
    const models = await listModels(body.provider, body.api_key, body.api_base_url);
    return jsonResponse({ models });
  } catch (err) {
    return errorResponse(`No se pudo obtener la lista de modelos: ${(err as Error).message}`, 502);
  }
});
