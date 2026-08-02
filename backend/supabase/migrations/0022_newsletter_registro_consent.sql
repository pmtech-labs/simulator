-- =========================================================
-- 0022: Consentimiento de boletín en el registro + sincronización Resend/Substack
-- =========================================================

alter table newsletter_subscribers add column if not exists synced_to_substack_at timestamptz;
alter table newsletter_subscribers add column if not exists synced_to_resend_at timestamptz;

comment on column newsletter_subscribers.synced_to_resend_at is
  'Marca de tiempo de alta exitosa en Resend (Contacts API). Null si aún no se ha
   sincronizado o si falló la llamada (se puede reconciliar después).';
comment on column newsletter_subscribers.synced_to_substack_at is
  'Marca de tiempo de sincronización con Substack. Substack no tiene API pública de
   suscripción (confirmado julio 2026) -- se rellena vía exportación CSV periódica o
   confirmación de suscripción por widget embebido, según se decida.';
