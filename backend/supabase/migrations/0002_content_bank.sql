-- =========================================================
-- 0002: Banco de contenido (clusters de caso + preguntas)
-- =========================================================

do $$ begin
  create type item_type as enum ('standalone', 'case_child', 'practicum');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_format as enum (
    'mc_single', 'mc_multi', 'matching', 'enhanced_matching',
    'graphic_based', 'hotspot', 'pulldown'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type approach_type as enum ('predictive', 'agile', 'hybrid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_status as enum ('draft', 'in_review', 'approved', 'published', 'retired');
exception when duplicate_object then null; end $$;

create table if not exists case_clusters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scenario_text text not null,
  media jsonb default '[]',
  primary_domain_id uuid references eco_domains(id),
  status item_status default 'draft',
  eco_version_id uuid references eco_versions(id),
  created_by uuid,
  reviewed_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  item_type item_type not null default 'standalone',
  format item_format not null default 'mc_single',
  cluster_id uuid references case_clusters(id) on delete cascade,
  stem text not null,
  options jsonb not null,
  correct_answer jsonb not null,
  explanation text not null,
  task_id uuid references eco_tasks(id) not null,
  enabler_ids uuid[] default '{}',
  approach approach_type not null,
  focus_tags text[] default '{}',
  difficulty smallint check (difficulty between 1 and 5) default 3,
  practicum_payload jsonb,
  status item_status default 'draft',
  eco_version_id uuid references eco_versions(id),
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  times_answered int default 0,
  times_correct int default 0,
  constraint case_child_requires_cluster
    check (item_type <> 'case_child' or cluster_id is not null)
);

create index if not exists idx_questions_task on questions(task_id);
create index if not exists idx_questions_cluster on questions(cluster_id);
create index if not exists idx_questions_status on questions(status);
create index if not exists idx_questions_approach on questions(approach);

-- Trigger genérico updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_case_clusters_updated on case_clusters;
create trigger trg_case_clusters_updated before update on case_clusters
  for each row execute function set_updated_at();

drop trigger if exists trg_questions_updated on questions;
create trigger trg_questions_updated before update on questions
  for each row execute function set_updated_at();

alter table case_clusters enable row level security;
alter table questions enable row level security;

-- El cliente (usuario final) solo puede leer contenido publicado.
-- La entrega real durante un examen se hace vía Edge Function con service_role,
-- que sí puede leer drafts para servir el examen en curso, pero el cliente anon/authenticated
-- nunca debe poder consultar correct_answer directamente en preguntas no publicadas.
create policy "lectura publica de clusters publicados" on case_clusters
  for select using (status = 'published');
create policy "lectura publica de preguntas publicadas" on questions
  for select using (status = 'published');

create policy "escritura solo service_role clusters" on case_clusters
  for all using (auth.role() = 'service_role');
create policy "escritura solo service_role questions" on questions
  for all using (auth.role() = 'service_role');

comment on column questions.times_answered is 'Telemetría agregada, incrementada por submit_answer, para detectar ítems mal calibrados.';
comment on column questions.practicum_payload is 'Datos extra según format: hotspots, pares de matching, dataset de gráfico. Ver especificación técnica sección 3.';
