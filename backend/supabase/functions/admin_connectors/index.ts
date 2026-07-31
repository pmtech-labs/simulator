// Edge Function: admin_connectors
//
// GET    -> lista conectores (sin exponer la API key)
// PATCH  -> edita un conector existente: nombre, modelo, URL base, marcarlo como
//           predeterminado (exclusivo), o rotar su API key (crea un secreto nuevo
//           en Vault; el anterior queda huérfano pero inaccesible, nunca se sobrescribe)
// POST   -> crea un conector nuevo: guarda la API key en Supabase Vault y solo
//           persiste en llm_connectors la referencia (secret_id), nunca la key en claro.
// DELETE -> desactiva un conector (is_active = false; no se borra para preservar
//           trazabilidad de qué conector generó qué preguntas)

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

interface CreateConnectorBody {
  name: string;
  provider: "anthropic" | "openai" | "openai_compatible" | "google";
  model_id: string;
  api_base_url?: string;
  api_key: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? url.searchParams.get("page_size") ?? 20);
    const offset = Number(
      url.searchParams.get("offset") ??
        (Number(url.searchParams.get("page") ?? 1) - 1) * limit,
    );

    const { data, error, count } = await admin
      .from("llm_connectors")
      .select("id, name, provider, model_id, api_base_url, is_active, is_default, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ data, total: count ?? data?.length ?? 0 });
  }

  if (req.method === "PATCH") {
    const body: {
      id: string;
      is_default?: boolean;
      name?: string;
      model_id?: string;
      api_base_url?: string | null;
      api_key?: string; // si se envía, rota la clave (nuevo secreto en Vault)
    } = await req.json();
    if (!body.id) return errorResponse("Falta el campo id", 400);

    const updatePayload: Record<string, unknown> = {};
    if (body.is_default !== undefined) updatePayload.is_default = body.is_default;
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.model_id !== undefined) updatePayload.model_id = body.model_id;
    if (body.api_base_url !== undefined) updatePayload.api_base_url = body.api_base_url;

    // Rotar la clave: se guarda un secreto nuevo en Vault, nunca se sobrescribe el existente
    // in situ (los secretos de Vault son inmutables por diseño en este esquema).
    if (body.api_key) {
      const { data: secretData, error: secretErr } = await admin.rpc("vault_create_secret_for_connector", {
        p_secret_value: body.api_key,
        p_name: `llm_connector_rotated_${body.id}_${Date.now()}`,
      });
      if (secretErr) return errorResponse(`Error guardando la nueva key en Vault: ${secretErr.message}`, 500);
      updatePayload.secret_id = secretData;
    }

    if (Object.keys(updatePayload).length === 0) {
      return errorResponse("No se ha indicado ningún campo para actualizar", 400);
    }

    const { data: connector, error } = await admin
      .from("llm_connectors")
      .update(updatePayload)
      .eq("id", body.id)
      .select("id, name, provider, model_id, api_base_url, is_active, is_default")
      .single();

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ connector });
  }

  if (req.method === "POST") {
    const body: CreateConnectorBody = await req.json();
    if (!body.name || !body.provider || !body.model_id || !body.api_key) {
      return errorResponse("Faltan campos requeridos (name, provider, model_id, api_key)", 400);
    }

    // Guardar la API key en Supabase Vault (cifrada). Nunca se guarda en una tabla normal.
    const { data: secretData, error: secretErr } = await admin.rpc("vault_create_secret_for_connector", {
      p_secret_value: body.api_key,
      p_name: `llm_connector_${body.name}_${Date.now()}`,
    });

    if (secretErr) return errorResponse(`Error guardando la key en Vault: ${secretErr.message}`, 500);

    const { data: connector, error: insertErr } = await admin
      .from("llm_connectors")
      .insert({
        name: body.name,
        provider: body.provider,
        model_id: body.model_id,
        api_base_url: body.api_base_url ?? null,
        secret_id: secretData,
        created_by: user.id,
      })
      .select("id, name, provider, model_id, is_active, created_at")
      .single();

    if (insertErr) return errorResponse(insertErr.message, 500);
    return jsonResponse({ connector }, 201);
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const connectorId = url.searchParams.get("id");
    if (!connectorId) return errorResponse("Falta el parámetro id", 400);

    const { error } = await admin
      .from("llm_connectors")
      .update({ is_active: false })
      .eq("id", connectorId);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ deactivated: connectorId });
  }

  return errorResponse("Método no soportado", 405);
});
