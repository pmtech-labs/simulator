-- =========================================================
-- 0017: CRÍTICO — cerrar exposición de la clave de respuestas del examen
--
-- La política "lectura pública de preguntas publicadas" en `questions` exponía TODAS
-- las columnas (incluidas correct_answer y explanation) a cualquier visitante vía
-- PostgREST directo con la clave anon, sin pasar por ninguna Edge Function. Cualquiera
-- podía leer la clave de respuestas completa desde la consola del navegador.
--
-- Fix: vista segura (v_questions_public) con solo metadatos no sensibles, ejecutada con
-- privilegios elevados (security_invoker=false) ya que ES el mecanismo de control de
-- acceso -- limita columnas y filtra status='published' en su propia definición. Se
-- quita el acceso público directo a la tabla real; todo el contenido (stem, options,
-- correct_answer, explanation) solo se sirve a través de start_exam/submit_answer/
-- finish_exam/admin_questions, que usan service_role y controlan cuándo se revela
-- la respuesta correcta.
-- =========================================================

create or replace view v_questions_public as
select
  q.id,
  q.item_type,
  q.format,
  q.cluster_id,
  q.task_id,
  q.approach,
  q.difficulty,
  q.status,
  q.created_at,
  t.task_number,
  t.title as task_title,
  d.code as domain_code
from questions q
join eco_tasks t on t.id = q.task_id
join eco_domains d on d.id = t.domain_id
where q.status = 'published';

alter view v_questions_public set (security_invoker = false);
grant select on v_questions_public to anon, authenticated;

drop policy if exists "lectura publica de preguntas publicadas" on questions;

comment on view v_questions_public is
  'Vista segura para lectura directa desde cliente (anon/authenticated): solo metadatos
   no sensibles de preguntas publicadas, aplanados (task_number/task_title/domain_code).
   NUNCA incluye stem, options, correct_answer ni explanation. security_invoker=false
   a propósito: esta vista ES el control de acceso, no debe heredar los permisos (nulos)
   del rol que consulta sobre la tabla real.';
