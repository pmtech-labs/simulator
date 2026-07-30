-- =========================================================
-- 0004: Sesiones de examen y respuestas
-- =========================================================

do $$ begin
  create type exam_mode as enum ('full_sim', 'domain_drill', 'case_only', 'custom');
exception when duplicate_object then null; end $$;

create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  license_id uuid references licenses(id),
  mode exam_mode not null default 'full_sim',
  config jsonb default '{}',
  total_questions int not null,
  time_limit_seconds int,
  started_at timestamptz default now(),
  finished_at timestamptz,
  score_pct numeric(5,2),
  score_by_domain jsonb,               -- {"people": 71.4, "process": 65.0, "business_environment": 58.3}
  score_by_approach jsonb,             -- {"predictive": 70, "agile": 60, "hybrid": 66}
  status text default 'in_progress'    -- in_progress | completed | abandoned
);

create table if not exists exam_items (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id) on delete cascade,
  question_id uuid references questions(id),
  cluster_id uuid references case_clusters(id),
  order_index int not null,
  is_pretest boolean default false,    -- 10 de las 180 no puntúan; nunca se revela al usuario
  user_answer jsonb,
  is_correct boolean,
  time_spent_seconds int,
  answered_at timestamptz,
  marked_for_review boolean default false
);

create index if not exists idx_exam_items_exam on exam_items(exam_id);
create index if not exists idx_exams_user on exams(user_id);
create index if not exists idx_exams_status on exams(status);

alter table exams enable row level security;
alter table exam_items enable row level security;

create policy "usuarios ven solo sus examenes" on exams
  for select using (auth.uid() = user_id);
create policy "usuarios crean sus examenes via rpc" on exams
  for insert with check (auth.uid() = user_id);
create policy "escritura completa solo service_role exams" on exams
  for update using (auth.role() = 'service_role');

create policy "usuarios ven items de sus examenes" on exam_items
  for select using (
    exists (select 1 from exams e where e.id = exam_items.exam_id and e.user_id = auth.uid())
  );
create policy "escritura solo service_role exam_items" on exam_items
  for all using (auth.role() = 'service_role');

comment on column exam_items.is_pretest is 'Ítems no puntuables (10 de 180 en full_sim). Se mezclan sin distinción visible para el usuario, igual que en el examen real de PMI.';
