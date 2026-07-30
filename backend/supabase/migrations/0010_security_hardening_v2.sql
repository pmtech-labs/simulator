-- =========================================================
-- 0010: Hardening de seguridad v2
--
-- Supabase otorga EXECUTE por defecto a anon/authenticated en funciones nuevas
-- del schema public. Esto revirtió silenciosamente parte del hardening de 0008.
-- Aquí se revoca de nuevo y, más importante, se cambia el comportamiento por
-- defecto para que las funciones futuras no hereden ese permiso automáticamente.
-- =========================================================

revoke execute on function upsert_task_mastery(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function upsert_task_mastery(uuid, uuid, boolean) to service_role;

revoke execute on function validate_bank_readiness() from public, anon, authenticated;
grant execute on function validate_bank_readiness() to service_role;

-- is_admin: intencionalmente invocable por authenticated (un usuario puede comprobar su propio
-- estado, la función solo devuelve un booleano y no expone datos), pero no por anon.
revoke execute on function is_admin(uuid) from public, anon;
grant execute on function is_admin(uuid) to authenticated, service_role;

-- A partir de aquí, cualquier función nueva en public requiere GRANT EXECUTE explícito
-- para ser invocable por anon/authenticated. Evita que este problema se repita.
alter default privileges in schema public revoke execute on functions from anon, authenticated;
