-- =========================================================
-- 0003: Licenciamiento (planes y licencias de usuario)
-- =========================================================

do $$ begin
  create type plan_code as enum ('basica_3m', 'premium_6m');
exception when duplicate_object then null; end $$;

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code plan_code not null unique,
  name text not null,
  duration_months int not null,
  price_cents int not null,
  currency text default 'EUR',
  includes_analytics boolean default false,
  includes_practicum_full boolean default false,
  includes_adaptive_engine boolean default false,
  stripe_price_id text
);

create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references plans(id),
  starts_at timestamptz default now(),
  expires_at timestamptz not null,
  status text default 'active',       -- active | expired | cancelled
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamptz default now()
);

create index if not exists idx_licenses_user on licenses(user_id);
create index if not exists idx_licenses_status on licenses(status);

alter table plans enable row level security;
alter table licenses enable row level security;

create policy "lectura publica de planes" on plans for select using (true);
create policy "escritura solo service_role plans" on plans for all using (auth.role() = 'service_role');

create policy "usuarios ven solo sus licencias" on licenses
  for select using (auth.uid() = user_id);
create policy "escritura solo service_role licenses" on licenses
  for all using (auth.role() = 'service_role');

-- Seed de los 2 planes iniciales (idempotente)
insert into plans (code, name, duration_months, price_cents, includes_analytics, includes_practicum_full, includes_adaptive_engine)
values
  ('basica_3m', 'Básica', 3, 4900, false, false, false),
  ('premium_6m', 'Premium', 6, 8900, true, true, true)
on conflict (code) do nothing;
