-- =========================================================
-- 0015: Conector LLM predeterminado (exclusivo, distinto de is_active)
--
-- is_active = "puede seleccionarse" (puede haber varios a la vez, para comparar
-- calidad de generación entre proveedores en distintos jobs).
-- is_default = "el que se preselecciona en el formulario de generación" — exclusivo,
-- solo uno a la vez, forzado por trigger.
-- =========================================================

alter table llm_connectors add column if not exists is_default boolean not null default false;

create or replace function enforce_single_default_connector()
returns trigger as $$
begin
  if new.is_default then
    update llm_connectors set is_default = false where id <> new.id and is_default;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_single_default_connector on llm_connectors;
create trigger trg_single_default_connector
  before insert or update of is_default on llm_connectors
  for each row execute function enforce_single_default_connector();

comment on column llm_connectors.is_default is
  'Exclusivo: solo un conector puede tener is_default=true a la vez (forzado por trigger).
   Distinto de is_active, que permite varios conectores utilizables simultáneamente.';
