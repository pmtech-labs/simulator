-- =========================================================
-- 0014: Trazabilidad job -> pregunta + v_question_stats completa
--
-- Corrige dos bugs de contrato encontrados al validar el panel admin real:
--  1. Las Edge Functions admin_connectors/admin_generation_jobs devolvían claves
--     ("connectors", "jobs") que no coincidían con lo que el frontend espera
--     ("data"/"rows"/"items"), así que la lista aparecía vacía aunque el guardado
--     en BD era correcto. Se corrige en las Edge Functions (no requiere SQL).
--  2. admin_questions no tenía ningún GET (405) — para poder listar con todos los
--     filtros que el frontend ya esperaba (status, domain_code, task_id, approach,
--     job_id, min_times_used, max_success_rate) hace falta: (a) saber qué job generó
--     cada pregunta, y (b) que la vista de estadísticas traiga también el contenido
--     completo, no solo las métricas agregadas.
-- =========================================================

alter table questions add column if not exists generation_job_id uuid references generation_jobs(id);
create index if not exists idx_questions_generation_job on questions(generation_job_id);

drop view if exists v_question_stats;

create view v_question_stats as
select
  q.id as question_id,
  q.stem,
  q.options,
  q.correct_answer,
  q.explanation,
  q.item_type,
  q.format,
  q.approach,
  q.difficulty,
  q.status,
  q.cluster_id,
  cc.scenario_text as cluster_scenario,
  q.generation_job_id,
  q.task_id,
  t.title as task_title,
  d.code as domain_code,
  d.name as domain_name,
  q.times_answered,
  q.times_correct,
  case when q.times_answered = 0 then null
       else round(100.0 * q.times_correct / q.times_answered, 2) end as success_rate_pct,
  (select count(*) from exam_items ei where ei.question_id = q.id) as times_used_in_exams,
  q.created_at
from questions q
join eco_tasks t on t.id = q.task_id
join eco_domains d on d.id = t.domain_id
left join case_clusters cc on cc.id = q.cluster_id;

alter view v_question_stats set (security_invoker = true);
grant select on v_question_stats to service_role;
revoke all on v_question_stats from anon, authenticated;

comment on column questions.generation_job_id is
  'Job de admin_generation_jobs que generó esta pregunta (null si se creó manualmente). Permite
   filtrar la cola de revisión por lote de generación y auditar qué conector/prompt produjo qué.';
