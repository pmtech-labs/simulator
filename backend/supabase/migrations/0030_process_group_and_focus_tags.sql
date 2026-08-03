-- =========================================================
-- 0030: "Áreas de Enfoque" (grupo de proceso) + activación real de "Nuevas Temáticas"
--
-- Requisitos del PO (documento de requisitos funcionales, R1):
--  - Áreas de Enfoque: 20% Inicio / 20% Planificación / 20% Ejecución /
--    20% Monitoreo y Control / 20% Cierre.
--  - Nuevas Temáticas: 50% Entrega de Valor / 10% Sostenibilidad / 10% IA / 30% ninguna.
--
-- "Dominios de Desempeño" (Gobernanza/Alcance/Cronograma/Finanzas/Recursos/Riesgos/
-- Interesados) del mismo documento NO se implementa todavía -- no encaja limpio en
-- las 26 tareas del ECO 2026 (parece una plantilla basada en las Áreas de Conocimiento
-- clásicas de PMBOK 6), pendiente de aclaración con el PO antes de forzar un mapeo.
-- =========================================================

create type process_group_type as enum ('initiation', 'planning', 'execution', 'monitoring_control', 'closing');

alter table questions add column if not exists process_group process_group_type;

comment on column questions.process_group is
  'Grupo de proceso clásico (Inicio/Planificación/Ejecución/Monitoreo y Control/Cierre)
   en el que se sitúa el escenario de la pregunta -- requisito del PO, objetivo 20%
   cada uno en el simulacro completo. Nullable: las preguntas creadas antes de este
   requisito no lo tienen asignado.';

comment on column questions.focus_tags is
  'Temas transversales de la pregunta. Valores usados por el generador para el
   requisito de "Nuevas Temáticas" del PO: "entrega_valor" (objetivo 50% del banco),
   "sostenibilidad" (objetivo 10%), "ia" (objetivo 10%). Array vacío = sin temática
   añadida (objetivo 30% restante).';
