-- =========================================================
-- 0021: Diplomas de finalización de simulacro completo
--
-- IMPORTANTE: PMI no publica una nota de corte oficial para el examen PMP (usa bandas
-- de desempeño por dominio: Above/Target/Below Target, sin porcentaje público). El
-- umbral usado aquí (threshold_pct) es un criterio de referencia propio de PMTech
-- Simulator, no la nota de corte oficial -- debe declararse siempre como tal en
-- cualquier interfaz que muestre el diploma.
-- =========================================================

create table if not exists diplomas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  score_pct numeric not null,
  score_by_domain jsonb,
  threshold_pct numeric not null,
  issued_at timestamptz not null default now(),
  unique (exam_id)
);

alter table diplomas enable row level security;

create policy "usuario ve sus propios diplomas" on diplomas
  for select using (auth.uid() = user_id);

create policy "escritura solo service_role diplomas" on diplomas
  for all using (auth.role() = 'service_role');

comment on table diplomas is
  'Diploma emitido al completar un simulacro completo (full_sim) con score_pct >=
   threshold_pct. threshold_pct es un criterio de referencia interno del producto, NO
   la nota de corte oficial de PMI (que no publica un porcentaje de aprobación fijo,
   usa bandas de desempeño Above/Target/Below Target por dominio). Debe mostrarse
   siempre esta aclaración en cualquier interfaz que muestre el diploma.';
