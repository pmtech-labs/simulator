-- =========================================================
-- 0001: Taxonomía ECO (referencia, se siembra una sola vez por versión)
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists eco_versions (
  id uuid primary key default gen_random_uuid(),
  label text not null,               -- 'ECO 2026'
  effective_date date not null,      -- '2026-07-09'
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists eco_domains (
  id uuid primary key default gen_random_uuid(),
  eco_version_id uuid references eco_versions(id) on delete cascade,
  code text not null,                 -- 'people' | 'process' | 'business_environment'
  name text not null,
  weight_pct numeric(5,2) not null,   -- 33.00 / 41.00 / 26.00
  sort_order int not null,
  unique (eco_version_id, code)
);

create table if not exists eco_tasks (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references eco_domains(id) on delete cascade,
  task_number int not null,           -- 1..8 / 1..10 / 1..8
  title text not null,
  sort_order int not null,
  unique (domain_id, task_number)
);

create table if not exists eco_enablers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references eco_tasks(id) on delete cascade,
  description text not null,
  sort_order int not null
);

comment on table eco_versions is 'Versiones del Exam Content Outline de PMI. Nunca se borra una versión antigua: se marca is_active=false y se crea una nueva.';
comment on table eco_domains is 'Los 3 dominios del ECO vigente (People/Process/Business Environment) con su peso oficial en % del examen.';
comment on table eco_tasks is 'Las 26 tareas oficiales del ECO 2026 (8+10+8), fuente: PDF oficial PMI julio 2026.';
comment on table eco_enablers is 'Ejemplos ilustrativos de trabajo asociados a cada tarea, tal como los define PMI. No exhaustivos.';

-- Lectura pública (son datos de referencia, no sensibles)
alter table eco_versions enable row level security;
alter table eco_domains enable row level security;
alter table eco_tasks enable row level security;
alter table eco_enablers enable row level security;

create policy "lectura publica eco_versions" on eco_versions for select using (true);
create policy "lectura publica eco_domains" on eco_domains for select using (true);
create policy "lectura publica eco_tasks" on eco_tasks for select using (true);
create policy "lectura publica eco_enablers" on eco_enablers for select using (true);

-- Solo service_role puede escribir en la taxonomía (se siembra desde el backend, nunca desde el cliente)
create policy "escritura solo service_role eco_versions" on eco_versions for all using (auth.role() = 'service_role');
create policy "escritura solo service_role eco_domains" on eco_domains for all using (auth.role() = 'service_role');
create policy "escritura solo service_role eco_tasks" on eco_tasks for all using (auth.role() = 'service_role');
create policy "escritura solo service_role eco_enablers" on eco_enablers for all using (auth.role() = 'service_role');
