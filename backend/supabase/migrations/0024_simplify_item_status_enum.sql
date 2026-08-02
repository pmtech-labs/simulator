-- =========================================================
-- 0024: Simplificar item_status de 5 a 3 estados
--
-- draft/in_review/approved/published/retired -> draft/published/retired.
-- Verificado antes de tocar nada: 0 preguntas y 0 case_clusters usaban in_review
-- o approved -- no tenían ninguna lógica funcional distinta de draft/published en
-- todo el backend, eran papeleo de workflow sin efecto real (útil solo si hubiera
-- varios revisores trabajando a la vez, que no es el caso hoy).
--
-- Requiere recrear 3 vistas (v_question_stats, v_questions_public, v_task_coverage)
-- y 2 políticas RLS que dependían del tipo enum. v_task_coverage.in_review_count se
-- deja como 0 fijo (en vez de quitar la columna) para no romper el frontend que ya
-- la lee (admin.index.tsx) -- ese contador simplemente será siempre 0 a partir de ahora.
-- =========================================================

create type item_status_v2 as enum ('draft', 'published', 'retired');

drop view if exists v_question_stats;
drop view if exists v_questions_public;
drop view if exists v_task_coverage;
drop policy if exists "lectura publica columnas seguras" on questions;
drop policy if exists "lectura publica de clusters publicados" on case_clusters;

alter table questions alter column status drop default;
alter table questions alter column status type item_status_v2 using status::text::item_status_v2;
alter table questions alter column status set default 'draft'::item_status_v2;

alter table case_clusters alter column status drop default;
alter table case_clusters alter column status type item_status_v2 using status::text::item_status_v2;
alter table case_clusters alter column status set default 'draft'::item_status_v2;

drop type item_status;
alter type item_status_v2 rename to item_status;

create policy "lectura publica columnas seguras" on questions
  for select to anon, authenticated
  using (status = 'published');

create policy "lectura publica de clusters publicados" on case_clusters
  for select using (status = 'published');

create view v_question_stats as
 SELECT q.id AS question_id,
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
    cc.scenario_text AS cluster_scenario,
    q.generation_job_id,
    lc.id AS generation_connector_id,
    lc.name AS generation_connector_name,
    lc.provider AS generation_provider,
    lc.model_id AS generation_model_id,
    q.task_id,
    t.title AS task_title,
    d.code AS domain_code,
    d.name AS domain_name,
    q.times_answered,
    q.times_correct,
        CASE
            WHEN q.times_answered = 0 THEN NULL::numeric
            ELSE round(100.0 * q.times_correct::numeric / q.times_answered::numeric, 2)
        END AS success_rate_pct,
    ( SELECT count(*) AS count
           FROM exam_items ei
          WHERE ei.question_id = q.id) AS times_used_in_exams,
    q.created_at
   FROM questions q
     JOIN eco_tasks t ON t.id = q.task_id
     JOIN eco_domains d ON d.id = t.domain_id
     LEFT JOIN case_clusters cc ON cc.id = q.cluster_id
     LEFT JOIN generation_jobs gj ON gj.id = q.generation_job_id
     LEFT JOIN llm_connectors lc ON lc.id = gj.connector_id;

alter view v_question_stats set (security_invoker = true);

create view v_questions_public as
 SELECT q.id,
    q.item_type,
    q.format,
    q.cluster_id,
    q.task_id,
    q.approach,
    q.difficulty,
    q.status,
    q.created_at,
    t.task_number,
    t.title AS task_title,
    d.code AS domain_code
   FROM questions q
     JOIN eco_tasks t ON t.id = q.task_id
     JOIN eco_domains d ON d.id = t.domain_id
  WHERE q.status = 'published'::item_status;

alter view v_questions_public set (security_invoker = true);
grant select on v_questions_public to anon, authenticated;

comment on view v_questions_public is
  'Vista de conveniencia para lectura directa desde cliente: metadatos no sensibles de
   preguntas publicadas, aplanados. La seguridad real la dan los GRANT de columna +
   política de fila en la tabla questions, no la vista en sí -- por eso puede ejecutarse
   en modo invoker estándar, sin necesitar "security definer".';

create view v_task_coverage as
 SELECT d.code AS domain_code,
    d.name AS domain_name,
    d.weight_pct AS domain_weight_pct,
    d.sort_order AS domain_sort_order,
    t.id AS task_id,
    t.task_number,
    t.title AS task_title,
    count(q.id) FILTER (WHERE q.status = 'published'::item_status) AS published_count,
    count(q.id) FILTER (WHERE q.status = 'draft'::item_status) AS draft_count,
    0::bigint AS in_review_count,
    count(q.id) FILTER (WHERE q.status = 'published'::item_status AND q.approach = 'predictive'::approach_type) AS published_predictive,
    count(q.id) FILTER (WHERE q.status = 'published'::item_status AND (q.approach = ANY (ARRAY['agile'::approach_type, 'hybrid'::approach_type]))) AS published_agile_hybrid
   FROM eco_tasks t
     JOIN eco_domains d ON d.id = t.domain_id
     LEFT JOIN questions q ON q.task_id = t.id
  GROUP BY d.code, d.name, d.weight_pct, d.sort_order, t.id, t.task_number, t.title
  ORDER BY d.sort_order, t.task_number;

alter view v_task_coverage set (security_invoker = true);
