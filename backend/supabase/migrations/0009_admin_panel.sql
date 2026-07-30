-- =========================================================
-- 0009: Panel de superadmin — roles, conectores LLM y jobs de generación
-- =========================================================

-- ---------- Roles de administrador ----------
-- Separado por completo de licenses/plans: un admin no necesariamente tiene licencia de candidato.
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',   -- por si en el futuro hay roles más granulares (reviewer, superadmin)
  created_at timestamptz default now(),
  created_by uuid
);

alter table admin_users enable row level security;
create policy "un admin puede ver la lista de admins" on admin_users
  for select using (exists (select 1 from admin_users a where a.user_id = auth.uid()));
create policy "escritura solo service_role admin_users" on admin_users
  for all using (auth.role() = 'service_role');

create or replace function is_admin(p_user_id uuid)
returns boolean as $$
  select exists (select 1 from admin_users where user_id = p_user_id);
$$ language sql stable security definer set search_path = public;

-- ---------- Conectores LLM ----------
-- La API key real NUNCA se guarda en esta tabla: se guarda en Supabase Vault
-- (vault.create_secret) y aquí solo se referencia su id. Ni el panel de admin
-- la vuelve a mostrar una vez guardada; solo se desencripta dentro de las Edge
-- Functions con service_role en el momento de llamar al LLM.
create table if not exists llm_connectors (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- p.ej. "Anthropic - producción"
  provider text not null,             -- 'anthropic' | 'openai' | 'google' | 'openai_compatible'
  model_id text not null,             -- p.ej. 'claude-sonnet-4-6', 'gpt-4.1'
  api_base_url text,                  -- para proveedores openai_compatible / self-hosted
  secret_id uuid not null,            -- referencia a vault.secrets.id
  is_active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table llm_connectors enable row level security;
create policy "admins ven los conectores (sin la key)" on llm_connectors
  for select using (is_admin(auth.uid()));
create policy "escritura solo service_role llm_connectors" on llm_connectors
  for all using (auth.role() = 'service_role');

comment on column llm_connectors.secret_id is 'Referencia a vault.secrets.id. La API key nunca se expone vía la API REST de Supabase.';

-- ---------- Jobs de generación bajo demanda ----------
create table if not exists generation_jobs (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid references llm_connectors(id),
  requested_by uuid references auth.users(id),
  -- parámetros de la solicitud
  task_ids uuid[] not null,           -- una o varias tareas ECO objetivo
  approach approach_type,             -- null = mezcla predictive/agile/hybrid
  format item_format not null default 'mc_single',
  count_requested int not null check (count_requested between 1 and 200),
  difficulty_min smallint default 1,
  difficulty_max smallint default 5,
  focus_tags text[] default '{}',
  -- estado de ejecución
  status text not null default 'queued', -- queued | running | completed | failed
  count_generated int default 0,
  count_failed int default 0,
  error_message text,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_generation_jobs_status on generation_jobs(status);

alter table generation_jobs enable row level security;
create policy "admins ven todos los jobs" on generation_jobs
  for select using (is_admin(auth.uid()));
create policy "escritura solo service_role generation_jobs" on generation_jobs
  for all using (auth.role() = 'service_role');

-- ---------- Vista de estadísticas para el dashboard de admin ----------
create or replace view v_question_stats as
select
  q.id as question_id,
  q.item_type,
  q.format,
  q.status,
  q.task_id,
  t.title as task_title,
  d.name as domain_name,
  q.times_answered,
  q.times_correct,
  case when q.times_answered = 0 then null
       else round(100.0 * q.times_correct / q.times_answered, 2) end as success_rate_pct,
  (select count(*) from exam_items ei where ei.question_id = q.id) as times_used_in_exams
from questions q
join eco_tasks t on t.id = q.task_id
join eco_domains d on d.id = t.domain_id;

alter view v_question_stats set (security_invoker = true);

create or replace view v_exam_stats as
select
  mode,
  status,
  count(*) as total_exams,
  round(avg(score_pct), 2) as avg_score_pct,
  min(started_at) as first_exam_at,
  max(started_at) as last_exam_at
from exams
group by mode, status;

alter view v_exam_stats set (security_invoker = true);

-- Solo admins pueden leer estas vistas (no forman parte de la experiencia del candidato)
revoke all on v_question_stats from anon, authenticated;
revoke all on v_exam_stats from anon, authenticated;
grant select on v_question_stats to service_role;
grant select on v_exam_stats to service_role;
