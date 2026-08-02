-- =========================================================
-- 0020: Datos del plan gratuito + control del simulacro de regalo
-- =========================================================

insert into plans (code, name, duration_months, price_cents, includes_analytics, includes_practicum_full, includes_adaptive_engine)
values ('free', 'Gratis', 999, 0, false, false, false)
on conflict (code) do nothing;

alter table licenses add column if not exists free_full_sim_used boolean not null default false;

comment on column licenses.free_full_sim_used is
  'Solo relevante para licencias del plan free: si ya se usó el único simulacro
   completo (full_sim) de regalo. La práctica por dominio/lección no tiene este límite.';
