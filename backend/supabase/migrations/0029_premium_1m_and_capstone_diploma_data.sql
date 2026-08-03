-- Plan Premium 1 mes: precio sugerido 24,90€ (más alto por mes que Premium 6 meses,
-- como es habitual para compromiso corto -- pendiente de confirmación/ajuste del PO).
insert into plans (code, name, duration_months, price_cents, includes_analytics, includes_practicum_full, includes_adaptive_engine)
values ('premium_1m', 'Premium 1 mes', 1, 2490, true, true, true)
on conflict (code) do nothing;

-- Diploma de "programa completo": exige haber aprobado el unit_quiz de TODAS las
-- lecciones del temario con tareas ECO asociadas + al menos un simulacro completo
-- con buen desempeño. Inspirado en el "Certificado de Finalización" (más exigente
-- que el diploma actual) que vimos en el simulador de un competidor.

alter table diplomas add column if not exists diploma_type text not null default 'simulacro_completo'
  check (diploma_type in ('simulacro_completo', 'programa_completo'));

alter table diplomas drop constraint if exists diplomas_exam_id_key;
alter table diplomas add constraint diplomas_exam_id_type_key unique (exam_id, diploma_type);

create unique index if not exists diplomas_one_capstone_per_user
  on diplomas (user_id) where (diploma_type = 'programa_completo');

comment on column diplomas.diploma_type is
  'simulacro_completo: por completar un full_sim con buen desempeño (existente).
   programa_completo: por completar TODAS las lecciones del temario (unit_quiz
   aprobado en cada una) + al menos un simulacro completo con buen desempeño. Máximo
   uno de este tipo por usuario.';
