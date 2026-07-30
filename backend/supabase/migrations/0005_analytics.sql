-- =========================================================
-- 0005: Analítica de brecha (mastery por tarea ECO)
-- =========================================================

create table if not exists user_task_mastery (
  user_id uuid references auth.users(id) on delete cascade,
  task_id uuid references eco_tasks(id) on delete cascade,
  attempts int default 0,
  correct int default 0,
  mastery_pct numeric(5,2) generated always as
    (case when attempts = 0 then 0 else round(100.0 * correct / attempts, 2) end) stored,
  last_attempt_at timestamptz,
  primary key (user_id, task_id)
);

alter table user_task_mastery enable row level security;

create policy "usuarios ven solo su mastery" on user_task_mastery
  for select using (auth.uid() = user_id);
create policy "escritura solo service_role mastery" on user_task_mastery
  for all using (auth.role() = 'service_role');

-- Función de utilidad: upsert de mastery tras cada respuesta (la invoca submit_answer)
create or replace function upsert_task_mastery(
  p_user_id uuid,
  p_task_id uuid,
  p_is_correct boolean
) returns void as $$
begin
  insert into user_task_mastery (user_id, task_id, attempts, correct, last_attempt_at)
  values (p_user_id, p_task_id, 1, case when p_is_correct then 1 else 0 end, now())
  on conflict (user_id, task_id) do update
    set attempts = user_task_mastery.attempts + 1,
        correct = user_task_mastery.correct + case when p_is_correct then 1 else 0 end,
        last_attempt_at = now();
end;
$$ language plpgsql security definer set search_path = public;

comment on function upsert_task_mastery is 'Actualiza incrementalmente el dominio de una tarea ECO para un usuario. Llamado por la Edge Function submit_answer.';

-- Solo el backend (service_role, vía la Edge Function submit_answer) puede invocar esta función.
-- Si un cliente anon/authenticated pudiera llamarla directamente por RPC, cualquier usuario
-- podría inflar su propio mastery sin pasar por la corrección real de submit_answer.
revoke execute on function upsert_task_mastery(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function upsert_task_mastery(uuid, uuid, boolean) to service_role;
