-- =========================================================
-- Seed: Temario del programa formativo (currículo propio)
--
-- Diseñado a partir de la estructura pedagógica estándar del mercado (Rita Mulcahy 11ª ed.,
-- organizada ya por dominios ECO People/Process/Business Environment; y estructura clásica de
-- áreas de conocimiento como agrupador temático familiar), mapeado a las 26 tareas exactas del
-- ECO 2026 (no copia contenido de esas fuentes — solo su lógica de agrupación temática).
--
-- 14 unidades, 26 tareas ECO cubiertas exactamente (unidad 1 es introductoria, sin tareas).
-- Idempotente: usa ON CONFLICT vía unique(sequence).
-- =========================================================

do $$
declare
  v_eco_id uuid;
  v_people uuid; v_process uuid; v_be uuid;
  v_u_id uuid;
begin
  select id into v_eco_id from eco_versions where label = 'ECO 2026';
  select id into v_people from eco_domains where eco_version_id=v_eco_id and code='people';
  select id into v_process from eco_domains where eco_version_id=v_eco_id and code='process';
  select id into v_be from eco_domains where eco_version_id=v_eco_id and code='business_environment';

  -- Unidad 1: introductoria, sin tareas ECO asociadas (no habilita unit_quiz, solo lectura)
  insert into course_units (title, description, sequence, status)
  values ('Fundamentos y panorama del examen PMP',
    'Estructura del examen ECO 2026, requisitos de elegibilidad, estrategia de estudio y gestión de la ansiedad ante el examen.',
    1, 'published')
  on conflict (sequence) do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Liderazgo y dirección del equipo',
    'Desarrollar una visión común y dirigir al equipo de proyecto: estilos de liderazgo, empoderamiento, roles y responsabilidades.',
    2, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=2;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_people and task_number in (1,3)
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Gestión de conflictos',
    'Fuentes de conflicto, estrategias de resolución y reglas básicas del equipo.',
    3, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=3;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_people and task_number=2
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Interesados: involucrar, alinear y gestionar expectativas',
    'Identificación, análisis, involucramiento y alineación de expectativas de interesados internos y externos.',
    4, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=4;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_people and task_number in (4,5,6)
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Comunicación y transferencia de conocimiento',
    'Estrategia de comunicación, transparencia, reportes y transferencia de conocimiento crítico del proyecto.',
    5, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=5;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_people and task_number in (7,8)
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Planificación integrada y enfoque de dirección',
    'Evaluar complejidad, elegir enfoque predictivo/ágil/híbrido, crear y mantener el plan integrado de dirección del proyecto.',
    6, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=6;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_process and task_number=1
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Alcance y entrega de valor',
    'Definir y descomponer el alcance; priorizar trabajo y entregar valor de forma incremental.',
    7, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=7;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_process and task_number in (2,3)
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Recursos y adquisiciones',
    'Planificación y gestión de recursos del equipo y de adquisiciones/contratos con proveedores.',
    8, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=8;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_process and task_number in (4,5)
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Finanzas y calidad',
    'Gestión financiera del proyecto y planificación/control de la calidad de productos y entregables.',
    9, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=9;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_process and task_number in (6,7)
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Cronograma y estado del proyecto',
    'Planificación y gestión del cronograma; evaluación continua del estado del proyecto mediante métricas y artefactos.',
    10, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=10;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_process and task_number in (8,9)
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Cierre del proyecto',
    'Criterios de cierre, validación de la transición y actividades finales del proyecto o fase.',
    11, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=11;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_process and task_number=10
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Gobernanza, cumplimiento y control de cambios',
    'Establecer la gobernanza del proyecto, gestionar el cumplimiento normativo y controlar cambios aprobados.',
    12, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=12;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_be and task_number in (1,2,3)
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Riesgos e impedimentos',
    'Identificación, análisis y respuesta a riesgos; eliminación de impedimentos y gestión de incidencias.',
    13, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=13;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_be and task_number in (4,5)
    on conflict do nothing;

  insert into course_units (title, description, sequence, status)
  values ('Mejora continua y entorno organizacional',
    'Lecciones aprendidas, apoyo al cambio organizacional y vigilancia del entorno empresarial externo.',
    14, 'published') on conflict (sequence) do nothing;
  select id into v_u_id from course_units where sequence=14;
  insert into course_unit_tasks (course_unit_id, task_id)
    select v_u_id, id from eco_tasks where domain_id=v_be and task_number in (6,7,8)
    on conflict do nothing;

end $$;
