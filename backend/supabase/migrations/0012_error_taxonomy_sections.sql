-- =========================================================
-- 0012: Taxonomía de errores + estructura real de 3 secciones + preguntas repetidas
--
-- Basado en SIMULADOR PMP - VISIÓN GENERAL.docx (conocimiento del proyecto):
--  - 8 tipos de error: conocimiento, interpretación, secuencia, rol, enfoque, lectura, análisis, tiempo
--  - El examen real son 3 secciones cronometradas independientes, no un timer único
--  - El resultado debe distinguir preguntas nuevas vs. ya vistas en intentos anteriores
-- =========================================================

do $$ begin
  create type error_type_enum as enum (
    'knowledge', 'interpretation', 'sequence', 'role', 'approach', 'reading', 'analysis', 'time'
  );
exception when duplicate_object then null; end $$;

-- ---------- Error tipado por distractor ----------
-- questions.options ya es jsonb; cada opción incorrecta debe llevar un campo "error_type"
-- documentado (uno de los 8 valores de error_type_enum). No se fuerza con un CHECK de Postgres
-- por ser jsonb, pero admin_generation_jobs/generate_questions.ts y validate_questions.ts deben
-- validarlo en la etapa de validación de forma.
comment on column questions.options is
  'Array de opciones [{id, text, error_type?}]. La opción correcta no lleva error_type. Cada
   distractor debe llevar uno de: knowledge, interpretation, sequence, role, approach, reading,
   analysis, time — según SIMULADOR PMP - VISIÓN GENERAL.docx.';

-- ---------- Secciones cronometradas del examen ----------
create table if not exists exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id) on delete cascade,
  section_number int not null,
  total_questions int not null,
  time_limit_seconds int not null,
  started_at timestamptz,
  finished_at timestamptz,
  status text not null default 'pending', -- pending | in_progress | completed
  unique (exam_id, section_number)
);

alter table exam_items add column if not exists section_number int;
alter table exam_items add column if not exists error_type_chosen error_type_enum;

alter table exams add column if not exists new_items_count int default 0;
alter table exams add column if not exists repeated_items_count int default 0;

alter table exam_sections enable row level security;
create policy "usuarios ven secciones de sus examenes" on exam_sections
  for select using (exists (select 1 from exams e where e.id = exam_sections.exam_id and e.user_id = auth.uid()));
create policy "escritura solo service_role exam_sections" on exam_sections
  for all using (auth.role() = 'service_role');

-- ---------- Estadísticas de patrones de error por usuario ----------
create table if not exists user_error_type_stats (
  user_id uuid references auth.users(id) on delete cascade,
  error_type error_type_enum not null,
  occurrences int default 0,
  last_seen_at timestamptz,
  primary key (user_id, error_type)
);

alter table user_error_type_stats enable row level security;
create policy "usuarios ven sus propios patrones de error" on user_error_type_stats
  for select using (auth.uid() = user_id);
create policy "escritura solo service_role user_error_type_stats" on user_error_type_stats
  for all using (auth.role() = 'service_role');

create or replace function record_error_type(p_user_id uuid, p_error_type error_type_enum)
returns void as $$
  insert into user_error_type_stats (user_id, error_type, occurrences, last_seen_at)
  values (p_user_id, p_error_type, 1, now())
  on conflict (user_id, error_type) do update
    set occurrences = user_error_type_stats.occurrences + 1,
        last_seen_at = now();
$$ language sql volatile security definer set search_path = public;

revoke execute on function record_error_type(uuid, error_type_enum) from public, anon, authenticated;
grant execute on function record_error_type(uuid, error_type_enum) to service_role;

comment on table exam_sections is
  'El examen real (full_sim) se divide en 3 secciones cronometradas independientes, con
   descansos entre ellas. Los clusters de caso nunca se dividen entre dos secciones.';
comment on column exams.new_items_count is
  'Cuántos ítems de este examen el usuario nunca había respondido antes. Un score alto con
   muchos ítems repetidos no debe interpretarse como preparación real (ver doc de producto).';
