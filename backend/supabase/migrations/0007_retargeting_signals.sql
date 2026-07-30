-- =========================================================
-- 0007: Señales de recompra dirigida
-- Alimentada por la Edge Function expire_licenses; consumida por la
-- herramienta de email (MailerLite/Brevo) vía un job externo o Zapier/Make.
-- =========================================================

create table if not exists retargeting_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,          -- p.ej. 'low_business_environment_mastery_on_expiry'
  detail jsonb default '{}',
  processed boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_retargeting_user on retargeting_signals(user_id);
create index if not exists idx_retargeting_unprocessed on retargeting_signals(processed) where processed = false;

alter table retargeting_signals enable row level security;
create policy "escritura y lectura solo service_role retargeting" on retargeting_signals
  for all using (auth.role() = 'service_role');
