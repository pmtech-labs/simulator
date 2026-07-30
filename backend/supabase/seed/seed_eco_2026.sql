-- =========================================================
-- Seed: ECO 2026 completo (fuente: PDF oficial PMI, julio 2026)
-- Idempotente: puede ejecutarse varias veces sin duplicar filas.
-- =========================================================

do $$
declare
  v_eco_id uuid;
  v_dom_people uuid;
  v_dom_process uuid;
  v_dom_be uuid;
  v_task uuid;
begin

  -- ---------- Versión ECO ----------
  select id into v_eco_id from eco_versions where label = 'ECO 2026';
  if v_eco_id is null then
    insert into eco_versions (label, effective_date, is_active)
    values ('ECO 2026', '2026-07-09', true)
    returning id into v_eco_id;
  end if;

  -- ---------- Dominios ----------
  insert into eco_domains (eco_version_id, code, name, weight_pct, sort_order)
  values
    (v_eco_id, 'people', 'People', 33.00, 1),
    (v_eco_id, 'process', 'Process', 41.00, 2),
    (v_eco_id, 'business_environment', 'Business Environment', 26.00, 3)
  on conflict (eco_version_id, code) do nothing;

  select id into v_dom_people from eco_domains where eco_version_id = v_eco_id and code = 'people';
  select id into v_dom_process from eco_domains where eco_version_id = v_eco_id and code = 'process';
  select id into v_dom_be from eco_domains where eco_version_id = v_eco_id and code = 'business_environment';

  -- =========================================================
  -- DOMINIO I: PEOPLE (8 tareas)
  -- =========================================================

  insert into eco_tasks (domain_id, task_number, title, sort_order) values
    (v_dom_people, 1, 'Desarrollar una visión común', 1),
    (v_dom_people, 2, 'Gestionar conflictos', 2),
    (v_dom_people, 3, 'Liderar al equipo de proyecto', 3),
    (v_dom_people, 4, 'Involucrar a los interesados', 4),
    (v_dom_people, 5, 'Alinear expectativas de los interesados', 5),
    (v_dom_people, 6, 'Gestionar expectativas de los interesados', 6),
    (v_dom_people, 7, 'Ayudar a garantizar la transferencia de conocimiento', 7),
    (v_dom_people, 8, 'Planificar y gestionar la comunicación', 8)
  on conflict (domain_id, task_number) do nothing;

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 1;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Ayudar a asegurar una visión compartida con los interesados clave', 1),
    (v_task, 'Promover la visión', 2),
    (v_task, 'Mantener la visión vigente', 3),
    (v_task, 'Descomponer situaciones para identificar la causa raíz de un malentendido sobre la visión', 4);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 2;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar fuentes de conflicto', 1),
    (v_task, 'Analizar el contexto del conflicto', 2),
    (v_task, 'Implementar una estrategia de resolución acordada', 3),
    (v_task, 'Comunicar principios de gestión de conflicto al equipo e interesados externos', 4),
    (v_task, 'Establecer un entorno que fomente el respeto de reglas comunes', 5),
    (v_task, 'Gestionar y rectificar violaciones de reglas', 6);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 3;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Establecer expectativas a nivel de equipo', 1),
    (v_task, 'Empoderar al equipo', 2),
    (v_task, 'Resolver problemas', 3),
    (v_task, 'Representar la voz del equipo', 4),
    (v_task, 'Apoyar la diversidad de experiencia, habilidades y perspectivas del equipo', 5),
    (v_task, 'Determinar un estilo de liderazgo apropiado', 6),
    (v_task, 'Establecer roles y responsabilidades claros dentro del equipo', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 4;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar interesados', 1),
    (v_task, 'Analizar interesados', 2),
    (v_task, 'Analizar y adaptar la comunicación a las necesidades de los interesados', 3),
    (v_task, 'Ejecutar el plan de involucramiento de interesados', 4),
    (v_task, 'Optimizar la alineación entre necesidades, expectativas y objetivos del proyecto', 5),
    (v_task, 'Generar confianza e influir en los interesados para lograr los objetivos del proyecto', 6);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 5;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Categorizar interesados', 1),
    (v_task, 'Identificar expectativas de los interesados', 2),
    (v_task, 'Facilitar discusiones para alinear expectativas', 3),
    (v_task, 'Organizar y actuar sobre oportunidades de mentoría', 4);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 6;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar expectativas de clientes internos y externos', 1),
    (v_task, 'Alinear y mantener resultados según las expectativas de clientes internos y externos', 2),
    (v_task, 'Monitorear la satisfacción/expectativas de clientes internos y externos y responder según corresponda', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 7;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar el conocimiento crítico para el proyecto', 1),
    (v_task, 'Recolectar conocimiento', 2),
    (v_task, 'Fomentar un entorno para la transferencia de conocimiento', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 8;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Definir una estrategia de comunicación', 1),
    (v_task, 'Promover la transparencia y la colaboración', 2),
    (v_task, 'Establecer un bucle de retroalimentación', 3),
    (v_task, 'Entender los requisitos de reporte', 4),
    (v_task, 'Crear reportes alineados con las expectativas de patrocinadores e interesados', 5),
    (v_task, 'Apoyar los procesos de reporte y gobernanza', 6);

  -- =========================================================
  -- DOMINIO II: PROCESS (10 tareas)
  -- =========================================================

  insert into eco_tasks (domain_id, task_number, title, sort_order) values
    (v_dom_process, 1, 'Desarrollar un plan integrado de gestión del proyecto y planificar la entrega', 1),
    (v_dom_process, 2, 'Desarrollar y gestionar el alcance del proyecto', 2),
    (v_dom_process, 3, 'Ayudar a garantizar la entrega basada en valor', 3),
    (v_dom_process, 4, 'Planificar y gestionar recursos', 4),
    (v_dom_process, 5, 'Planificar y gestionar adquisiciones', 5),
    (v_dom_process, 6, 'Planificar y gestionar finanzas', 6),
    (v_dom_process, 7, 'Planificar y optimizar la calidad de productos/entregables', 7),
    (v_dom_process, 8, 'Planificar y gestionar el cronograma', 8),
    (v_dom_process, 9, 'Evaluar el estado del proyecto', 9),
    (v_dom_process, 10, 'Gestionar el cierre del proyecto', 10)
  on conflict (domain_id, task_number) do nothing;

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 1;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Evaluar la necesidad, complejidad y magnitud del proyecto', 1),
    (v_task, 'Recomendar un enfoque de desarrollo del proyecto (predictivo, adaptativo/ágil o híbrido)', 2),
    (v_task, 'Determinar requisitos de información crítica (p. ej. sostenibilidad)', 3),
    (v_task, 'Recomendar una estrategia de ejecución del proyecto', 4),
    (v_task, 'Crear un plan integrado de gestión del proyecto', 5),
    (v_task, 'Estimar el esfuerzo de trabajo y los requisitos de recursos', 6),
    (v_task, 'Evaluar los planes consolidados del proyecto en busca de dependencias, brechas y valor de negocio continuado', 7),
    (v_task, 'Mantener el plan integrado de gestión del proyecto', 8),
    (v_task, 'Recolectar y analizar datos para tomar decisiones informadas del proyecto', 9);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 2;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Definir el alcance', 1),
    (v_task, 'Obtener el acuerdo de los interesados sobre el alcance del proyecto', 2),
    (v_task, 'Descomponer el alcance', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 3;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar componentes de valor junto con los interesados clave', 1),
    (v_task, 'Priorizar el trabajo según el valor y la retroalimentación de los interesados', 2),
    (v_task, 'Evaluar oportunidades para entregar valor de forma incremental', 3),
    (v_task, 'Examinar el valor de negocio a lo largo del proyecto', 4),
    (v_task, 'Verificar que exista un sistema de medición para hacer seguimiento de los beneficios', 5),
    (v_task, 'Evaluar opciones de entrega para demostrar valor', 6);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 4;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Definir y planificar recursos según los requisitos', 1),
    (v_task, 'Gestionar y optimizar la necesidad y disponibilidad de recursos', 2);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 5;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Planificar las adquisiciones', 1),
    (v_task, 'Ejecutar un plan de gestión de adquisiciones', 2),
    (v_task, 'Seleccionar los tipos de contrato preferidos', 3),
    (v_task, 'Evaluar el desempeño de los proveedores', 4),
    (v_task, 'Verificar que se cumplan los objetivos del acuerdo de adquisición', 5),
    (v_task, 'Participar en negociaciones de acuerdos', 6),
    (v_task, 'Determinar una estrategia de negociación', 7),
    (v_task, 'Gestionar proveedores y contratos', 8),
    (v_task, 'Planificar y gestionar la estrategia de adquisiciones', 9),
    (v_task, 'Desarrollar una solución de entrega', 10);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 6;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Analizar las necesidades financieras del proyecto', 1),
    (v_task, 'Cuantificar asignaciones financieras de riesgo y contingencia', 2),
    (v_task, 'Planificar el seguimiento del gasto a lo largo del ciclo de vida del proyecto', 3),
    (v_task, 'Planificar el reporte financiero', 4),
    (v_task, 'Anticipar futuros retos financieros', 5),
    (v_task, 'Monitorear variaciones financieras y trabajar con el proceso de gobernanza', 6),
    (v_task, 'Gestionar reservas financieras', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 7;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Recolectar requisitos de calidad para los entregables del proyecto', 1),
    (v_task, 'Planificar procesos y herramientas de calidad', 2),
    (v_task, 'Ejecutar un plan de gestión de la calidad', 3),
    (v_task, 'Ayudar a garantizar el cumplimiento regulatorio', 4),
    (v_task, 'Gestionar el costo de calidad (CoQ) y la sostenibilidad', 5),
    (v_task, 'Realizar revisiones de calidad continuas', 6),
    (v_task, 'Implementar mejora continua', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 8;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Preparar un cronograma según el enfoque de desarrollo seleccionado', 1),
    (v_task, 'Coordinar con otros proyectos y operaciones', 2),
    (v_task, 'Estimar tareas del proyecto (hitos, dependencias, story points)', 3),
    (v_task, 'Utilizar benchmarks y datos históricos', 4),
    (v_task, 'Crear un cronograma del proyecto', 5),
    (v_task, 'Establecer la línea base del cronograma', 6),
    (v_task, 'Ejecutar un plan de gestión del cronograma', 7),
    (v_task, 'Analizar la variación del cronograma', 8);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 9;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Desarrollar métricas del proyecto, análisis y reconciliación', 1),
    (v_task, 'Identificar y adaptar los artefactos necesarios', 2),
    (v_task, 'Ayudar a garantizar que los artefactos se creen, revisen, actualicen y documenten', 3),
    (v_task, 'Ayudar a garantizar la accesibilidad de los artefactos', 4),
    (v_task, 'Evaluar el progreso actual', 5),
    (v_task, 'Medir, analizar y actualizar métricas del proyecto', 6),
    (v_task, 'Comunicar el estado del proyecto', 7),
    (v_task, 'Evaluar continuamente la efectividad de la gestión de artefactos', 8);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 10;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Obtener la aprobación de los interesados sobre la finalización del proyecto', 1),
    (v_task, 'Determinar los criterios para cerrar exitosamente el proyecto o fase', 2),
    (v_task, 'Validar la preparación para la transición (p. ej. a operaciones o a la siguiente fase)', 3),
    (v_task, 'Concluir actividades de cierre del proyecto o fase (lecciones aprendidas, retrospectivas, adquisiciones, financiero, recursos)', 4);

  -- =========================================================
  -- DOMINIO III: BUSINESS ENVIRONMENT (8 tareas)
  -- =========================================================

  insert into eco_tasks (domain_id, task_number, title, sort_order) values
    (v_dom_be, 1, 'Definir y establecer la gobernanza del proyecto', 1),
    (v_dom_be, 2, 'Planificar y gestionar el cumplimiento del proyecto', 2),
    (v_dom_be, 3, 'Gestionar y controlar cambios', 3),
    (v_dom_be, 4, 'Eliminar impedimentos y gestionar incidencias', 4),
    (v_dom_be, 5, 'Planificar y gestionar el riesgo', 5),
    (v_dom_be, 6, 'Mejora continua', 6),
    (v_dom_be, 7, 'Apoyar el cambio organizacional', 7),
    (v_dom_be, 8, 'Evaluar cambios del entorno empresarial externo', 8)
  on conflict (domain_id, task_number) do nothing;

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 1;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Describir y establecer la estructura, reglas, procedimientos, reporte, ética y políticas usando activos de procesos organizacionales (OPAs)', 1),
    (v_task, 'Definir métricas de éxito', 2),
    (v_task, 'Delimitar rutas y umbrales de escalamiento de la gobernanza', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 2;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Confirmar los requisitos de cumplimiento del proyecto (seguridad, salud y seguridad, sostenibilidad, cumplimiento regulatorio)', 1),
    (v_task, 'Clasificar categorías de cumplimiento', 2),
    (v_task, 'Determinar amenazas potenciales al cumplimiento', 3),
    (v_task, 'Usar métodos para apoyar el cumplimiento', 4),
    (v_task, 'Analizar las consecuencias del incumplimiento', 5),
    (v_task, 'Determinar el enfoque y las acciones necesarias para atender necesidades de cumplimiento', 6),
    (v_task, 'Medir el grado en que el proyecto está en cumplimiento', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 3;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Ejecutar el proceso de control de cambios', 1),
    (v_task, 'Comunicar el estado de los cambios propuestos', 2),
    (v_task, 'Implementar los cambios aprobados en el proyecto', 3),
    (v_task, 'Actualizar la documentación del proyecto para reflejar los cambios', 4);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 4;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Evaluar el impacto de los impedimentos', 1),
    (v_task, 'Priorizar y destacar impedimentos', 2),
    (v_task, 'Determinar y aplicar una estrategia de intervención para eliminar/minimizar impedimentos', 3),
    (v_task, 'Reevaluar continuamente para ayudar a garantizar que los impedimentos, obstáculos y bloqueos del equipo se estén atendiendo', 4),
    (v_task, 'Reconocer cuándo un riesgo se convierte en una incidencia', 5),
    (v_task, 'Colaborar con los interesados relevantes en un enfoque para resolver las incidencias', 6);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 5;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar riesgos', 1),
    (v_task, 'Analizar riesgos', 2),
    (v_task, 'Monitorear y controlar riesgos', 3),
    (v_task, 'Desarrollar un plan de gestión de riesgos', 4),
    (v_task, 'Mantener un registro de riesgos (p. ej. seguridad IT deficiente)', 5),
    (v_task, 'Ejecutar un plan de gestión de riesgos (p. ej. respuesta de riesgo para seguridad y gestión de riesgos de sostenibilidad)', 6),
    (v_task, 'Comunicar el estado del impacto de un riesgo en el proyecto', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 6;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Utilizar lecciones aprendidas', 1),
    (v_task, 'Ayudar a garantizar que los procesos de mejora continua estén actualizados', 2),
    (v_task, 'Actualizar los activos de procesos organizacionales (OPAs)', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 7;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Evaluar la cultura organizacional', 1),
    (v_task, 'Evaluar el impacto del cambio organizacional en el proyecto y determinar las acciones requeridas', 2);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 8;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Monitorear cambios en el entorno empresarial externo (regulación, tecnología, geopolítica, mercado)', 1),
    (v_task, 'Evaluar y priorizar el impacto en el alcance/backlog del proyecto según cambios en el entorno externo', 2),
    (v_task, 'Revisar continuamente el entorno empresarial externo en busca de impactos en el alcance/backlog', 3);

end $$;
