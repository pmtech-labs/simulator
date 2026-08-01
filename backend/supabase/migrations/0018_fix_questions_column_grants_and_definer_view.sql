-- =========================================================
-- 0018: Permisos por columna en questions + eliminar Security Definer View
--
-- Segundo hallazgo del linter de Supabase: v_questions_public quedó marcada como
-- "security definer view" (0010_security_definer_view) porque en la migración 0017
-- tuvo que ponerse security_invoker=false para que funcionara con anon/authenticated.
--
-- Al investigar la causa raíz se encontró algo más serio: anon y authenticated tenían
-- GRANT ALL (INSERT/UPDATE/SELECT/REFERENCES) heredado por defecto sobre TODAS las
-- columnas de `questions`, incluidas correct_answer y explanation. RLS era la única
-- barrera real conteniendo esto -- funcional tras la migración 0017, pero una
-- configuración de permisos peligrosa por diseño (defensa en profundidad rota).
--
-- Fix con el patrón correcto de Postgres: permisos por columna (GRANT SELECT solo en
-- las columnas seguras) + política de fila normal. Con esto la vista ya no necesita
-- privilegios elevados y puede volver a modo invoker estándar.
-- =========================================================

revoke all on questions from anon, authenticated;

grant select (id, item_type, format, cluster_id, task_id, approach, difficulty, status, created_at)
  on questions to anon, authenticated;

create policy "lectura publica columnas seguras" on questions
  for select to anon, authenticated
  using (status = 'published');

alter view v_questions_public set (security_invoker = true);

comment on view v_questions_public is
  'Vista de conveniencia para lectura directa desde cliente: metadatos no sensibles de
   preguntas publicadas, aplanados. La seguridad real la dan los GRANT de columna +
   política de fila en la tabla questions, no la vista en sí -- por eso puede ejecutarse
   en modo invoker estándar, sin necesitar "security definer".';

-- Verificado con pruebas HTTP reales contra la clave anon tras aplicar:
--  - select correct_answer directo a questions -> 401 permission denied (rechazo real
--    de Postgres, no solo fila vacía por RLS)
--  - select de columnas seguras directo a questions -> 200, funciona
--  - INSERT directo como anon -> 401 permission denied
--  - select sobre v_questions_public -> 200, funciona, ya no es security definer
