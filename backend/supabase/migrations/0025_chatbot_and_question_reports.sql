-- =========================================================
-- 0025: Sistema de reporte de problemas en preguntas
--
-- Inspirado en el flujo manual de un competidor ("me envías el texto completo de la
-- pregunta y mejoro la explicación en la plataforma"), pero integrado directamente en
-- la cola de revisión del panel admin en vez de por email suelto.
-- =========================================================

create table if not exists question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid references exams(id) on delete set null,
  comment text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

alter table question_reports enable row level security;

create policy "usuario crea sus propios reportes" on question_reports
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "usuario ve sus propios reportes" on question_reports
  for select to authenticated
  using (auth.uid() = user_id);

create policy "escritura completa solo service_role reportes" on question_reports
  for all using (auth.role() = 'service_role');

comment on table question_reports is
  'Reportes de problemas en preguntas enviados por candidatos durante práctica o
   revisión de resultado. status=open hasta que un admin lo marca resolved tras
   revisar/corregir la pregunta.';

drop view if exists v_question_stats;

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
    q.created_at,
    ( SELECT count(*) AS count
           FROM question_reports qr
          WHERE qr.question_id = q.id AND qr.status = 'open') AS open_reports_count
   FROM questions q
     JOIN eco_tasks t ON t.id = q.task_id
     JOIN eco_domains d ON d.id = t.domain_id
     LEFT JOIN case_clusters cc ON cc.id = q.cluster_id
     LEFT JOIN generation_jobs gj ON gj.id = q.generation_job_id
     LEFT JOIN llm_connectors lc ON lc.id = gj.connector_id;

alter view v_question_stats set (security_invoker = true);
