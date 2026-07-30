-- =========================================================
-- 0011: Wrappers de Supabase Vault
--
-- El schema `vault` no está expuesto vía la API REST (PostgREST) por diseño.
-- Estas funciones envuelven vault.create_secret / vault.decrypted_secrets y
-- se restringen exclusivamente a service_role: solo las Edge Functions del
-- panel de admin pueden crear o leer las API keys de los conectores LLM.
-- =========================================================

create or replace function vault_create_secret_for_connector(p_secret_value text, p_name text)
returns uuid as $$
  select vault.create_secret(p_secret_value, p_name, 'API key de conector LLM (simulador PMP)');
$$ language sql volatile security definer set search_path = public, vault;

create or replace function vault_read_secret_for_connector(p_secret_id uuid)
returns text as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_secret_id;
$$ language sql stable security definer set search_path = public, vault;

revoke execute on function vault_create_secret_for_connector(text, text) from public, anon, authenticated;
grant execute on function vault_create_secret_for_connector(text, text) to service_role;

revoke execute on function vault_read_secret_for_connector(uuid) from public, anon, authenticated;
grant execute on function vault_read_secret_for_connector(uuid) to service_role;

comment on function vault_read_secret_for_connector is
  'Solo debe invocarse desde dentro de una Edge Function con service_role, justo antes de llamar al LLM, y nunca devolver el resultado al cliente.';
