-- Migración aplicada directamente en producción (agosto 2026) en respuesta a
-- 2 hallazgos CRÍTICOS del escáner de seguridad de Supabase. Documentada aquí
-- para que quede en el historial del repo aunque se aplicara vía MCP.

-- HALLAZGO 1 (Crítico): "Exam answer key readable by anyone via direct table
-- query". La política "lectura publica columnas seguras" en `questions` tenía
-- un nombre engañoso: RLS en Postgres es a nivel de FILA, no de columna, así
-- que exponía TODAS las columnas (incluidas correct_answer y explanation --
-- la clave de respuestas del examen) a cualquiera con la api key `anon`, vía
-- una simple consulta directa a /rest/v1/questions?select=correct_answer.
--
-- Auditoría de código confirmó que NINGÚN flujo real de la app depende de
-- leer correct_answer/explanation/stem/options directamente de la tabla --
-- start_exam y submit_answer (con service_role, que ignora RLS y column
-- grants) son el único camino legítimo para ver contenido y respuesta. El
-- único caso de lectura directa autenticada real es performanceService.ts,
-- que solo necesita metadatos (approach, performance_domain, focus_tags,
-- task_id) para analítica, nunca contenido ni respuesta.
--
-- Corrección: RLS por sí solo no puede dar "seguridad por columna" -- se
-- mantiene la política de FILA (necesaria para performanceService.ts) y se
-- añade la restricción real a nivel de COLUMNA vía REVOKE/GRANT.
revoke select on questions from anon, authenticated;
grant select (
  id, item_type, format, cluster_id, task_id, approach, focus_tags,
  difficulty, status, created_at, process_group, performance_domain, question_number
) on questions to anon, authenticated;

-- HALLAZGO 2 (Crítico): "Security Definer View" -- v_question_stats tenía
-- security_invoker=false (equivalente a SECURITY DEFINER), ejecutándose con
-- los privilegios de quien CREÓ la vista en vez de quien la consulta, e
-- ignorando las políticas RLS de las tablas subyacentes. El rol
-- `authenticated` (cualquier candidato logueado) tenía GRANT SELECT sobre
-- esta vista, con la cláusula WHERE is_admin(auth.uid()) OR
-- auth.role()='service_role' como única barrera.
--
-- Primer intento: alter view v_question_stats set (security_invoker = true).
-- Esto rompió el panel de admin real -- tras el hallazgo 1, `authenticated`
-- ya no tiene GRANT de columna sobre stem/options/correct_answer/explanation
-- en `questions`, y los admins SON simplemente usuarios `authenticated`
-- (Postgres no tiene un sub-rol "admin" a nivel de GRANT). Con
-- security_invoker=true la vista hereda esa restricción de columna incluso
-- para admins legítimos.
--
-- Corrección final: security_invoker=false es una excepción documentada e
-- intencional para ESTA vista concreta -- necesita leer columnas completas
-- como el propietario de la vista, con is_admin(auth.uid()) (confirmado
-- SECURITY DEFINER con search_path fijado, sin superficie de inyección,
-- misma función que usan todas las políticas RLS del esquema) como única
-- puerta -- es la única forma de dar a los admins acceso de columna completo
-- sin también dárselo a cualquier candidato autenticado. Las otras 3 vistas
-- (v_exam_stats, v_questions_public, v_task_coverage) no tienen este
-- conflicto y se quedan correctamente en security_invoker=true.
alter view v_question_stats set (security_invoker = false);

-- Verificado con datos reales tras aplicar (no solo revisión de código):
-- - anon/authenticated intentando leer correct_answer/explanation de
--   `questions` directamente -> 42501 permission denied (antes: 200 OK,
--   clave de respuestas completa expuesta).
-- - anon/authenticated leyendo columnas seguras (approach, difficulty,
--   format...) -> sigue funcionando sin cambios.
-- - start_exam (service_role) -> sigue entregando stem sin correct_answer,
--   sin cambios de comportamiento.
-- - submit_answer (service_role) -> sigue revelando correct_answer/
--   explanation tras responder, sin cambios de comportamiento.
-- - Usuario admin real consultando v_question_stats -> sigue viendo
--   correct_answer y demás columnas completas, sin cambios.
-- - Usuario autenticado NO admin consultando v_question_stats -> [] vacío
--   (bloqueado correctamente por el WHERE), y permission denied al intentar
--   leer columnas sensibles de `questions` directamente.
