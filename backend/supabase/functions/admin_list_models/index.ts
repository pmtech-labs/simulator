// Edge Function: admin_list_models
//
// POST -> lista los modelos disponibles de un proveedor, de dos formas:
//   (a) Flujo de creación: { provider, api_key, api_base_url? } — la key la acaba de
//       teclear el admin, todavía sin guardar. Nunca se persiste aquí.
//   (b) Flujo de edición: { connector_id } — reutiliza la key ya guardada en Vault
//       para ese conector, sin que el admin tenga que volver a teclearla ni que
//       viaje nunca al navegador.
//
// Pensado para poblar el desplegable de modelo en el formulario de alta/edición de
// conectores, en vez de dejar que el admin escriba un model_id a mano (causa real
// de un fallo anterior: se creó un conector con model_id="GPT-5", que no existe).

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { listModels } from "../_shared/llmProviders.ts";

interface ListModelsBody {
  provider?: "anthropic" | "openai" | "openai_compatible" | "google";
  api_key?: string;
  api_base_url?: string;
  connector_id?: string; // alternativa: reutiliza la key ya guardada de ese conector
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const body: ListModelsBody = await req.json();
  const admin = getSupabaseAdmin();

  let provider = body.provider;
  let apiKey = body.api_key;
  let apiBaseUrl = body.api_base_url;

  if (body.connector_id) {
    const { data: connector, error: connectorErr } = await admin
      .from("llm_connectors")
      .select("provider, api_base_url, secret_id")
      .eq("id", body.connector_id)
      .single();
    if (connectorErr || !connector) return errorResponse("Conector no encontrado", 404);

    const { data: storedKey, error: keyErr } = await admin.rpc("vault_read_secret_for_connector", {
      p_secret_id: connector.secret_id,
    });
    if (keyErr || !storedKey) return errorResponse("No se pudo leer la API key guardada del conector", 500);

    provider = connector.provider as ListModelsBody["provider"];
    apiKey = storedKey;
    apiBaseUrl = connector.api_base_url ?? undefined;
  }

  if (!provider || !apiKey) {
    return errorResponse("Faltan campos requeridos (provider + api_key, o connector_id)", 400);
  }

  try {
    const models = await listModels(provider, apiKey, apiBaseUrl);
    return jsonResponse({ models });
  } catch (err) {
    return errorResponse(`No se pudo obtener la lista de modelos: ${(err as Error).message}`, 502);
  }
});
