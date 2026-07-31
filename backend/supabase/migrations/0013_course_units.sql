-- =========================================================
-- 0013: Currículo (unidades/lecciones) + modos "por lección" y "acumulativo"
--
-- Basado en SIMULADOR PMP - VISIÓN GENERAL.docx: "cuestionario de una unidad", "simulador de
-- una lección", "simulador acumulativo" son modalidades de práctica ligadas a la progresión
-- del curso/temario propio (no a la taxonomía ECO directamente). Se modelan como una capa
-- de currículo que mapea unidades de lección a tareas ECO (muchos-a-muchos).
-- =========================================================

-- ---------- Unidades de currículo (lecciones del programa formativo) ----------
create table if not exists course_units (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sequence int not null,              -- orden de la unidad dentro del temario (1, 2, 3...)
  status text not null default 'draft', -- draft | published
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (sequence)
);

-- ---------- Mapeo unidad <-> tarea ECO (muchos a muchos) ----------
create table if not exists course_unit_tasks (
  course_unit_id uuid references course_units(id) on delete cascade,
  task_id uuid references eco_tasks(id) on delete cascade,
  primary key (course_unit_id, task_id)
);

drop trigger if exists trg_course_units_updated on course_units;
create trigger trg_course_units_updated before update on course_units
  for each row execute function set_updated_at();

alter table course_units enable row level security;
alter table course_unit_tasks enable row level security;

create policy "lectura publica de unidades publicadas" on course_units
  for select using (status = 'published');
create policy "escritura solo service_role course_units" on course_units
  for all using (auth.role() = 'service_role');

create policy "lectura publica de mapeo unidad-tarea" on course_unit_tasks
  for select using (
    exists (select 1 from course_units cu where cu.id = course_unit_tasks.course_unit_id and cu.status = 'published')
  );
create policy "escritura solo service_role course_unit_tasks" on course_unit_tasks
  for all using (auth.role() = 'service_role');

-- ---------- Nuevos modos de examen ----------
alter type exam_mode add value if not exists 'unit_quiz';
alter type exam_mode add value if not exists 'cumulative';

comment on table course_units is
  'Unidades/lecciones del programa formativo propio (no de PMI). Permite modos de práctica
   "por lección" y "acumulativo" (todo lo visto hasta esta unidad), ligados a la progresión
   del curso en vez de solo a la taxonomía ECO.';
comment on table course_unit_tasks is
  'Mapeo muchos-a-muchos: qué tareas ECO cubre cada unidad del temario. Una tarea puede
   reforzarse en varias unidades; una unidad puede cubrir varias tareas.';
