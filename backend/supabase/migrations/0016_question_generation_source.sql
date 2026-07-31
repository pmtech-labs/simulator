-- =========================================================
-- 0016: Trazabilidad de fuente de generación en v_question_stats
--
-- Añade generation_connector_id/name, generation_provider y generation_model_id,
-- resueltos vía questions.generation_job_id -> generation_jobs.connector_id ->
-- llm_connectors. Null para preguntas creadas manualmente o si el conector que
-- las generó ya no existe (los conectores nunca se borran, solo se desactivan,
-- así que en la práctica esto solo pasa con contenido manual).
-- =========================================================

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
  lc.id as generation_connector_id,
  lc.name as generation_connector_name,
  lc.provider as generation_provider,
  lc.model_id as generation_model_id,
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
left join case_clusters cc on cc.id = q.cluster_id
left join generation_jobs gj on gj.id = q.generation_job_id
left join llm_connectors lc on lc.id = gj.connector_id;

alter view v_question_stats set (security_invoker = true);
grant select on v_question_stats to service_role;
revoke all on v_question_stats from anon, authenticated;

comment on view v_question_stats is
  'Vista de contenido + estadisticas + fuente de generacion (proveedor/modelo) de cada pregunta.
   generation_provider/generation_model_id son null para preguntas creadas manualmente
   (sin generation_job_id) o si el conector que la genero ya no existe.';
