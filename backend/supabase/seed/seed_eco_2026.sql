-- =========================================================
-- Seed: ECO 2026 completo (fuente: ECO Esquema del contenido del examen 2026.pdf,
-- documento oficial de PMI subido al conocimiento del proyecto — texto verbatim en español).
-- Idempotente: puede ejecutarse varias veces sin duplicar filas.
--
-- Corregido el 31/07/2026 tras comparar contra el PDF exacto del conocimiento del proyecto:
-- la versión anterior de este seed usaba una traducción parafraseada (obtenida por web_fetch)
-- que difería en la redacción de varios títulos y facilitadores (ej. Tarea 3 de People era
-- "Liderar al equipo de proyecto" y debe ser "Dirigir al equipo de proyecto"). Esta versión
-- es fiel palabra por palabra al documento oficial.
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
  -- DOMINIO I: PERSONAS (8 tareas, 39 facilitadores)
  -- =========================================================

  insert into eco_tasks (domain_id, task_number, title, sort_order) values
    (v_dom_people, 1, 'Desarrollar una visión común', 1),
    (v_dom_people, 2, 'Gestionar los conflictos', 2),
    (v_dom_people, 3, 'Dirigir al equipo de proyecto', 3),
    (v_dom_people, 4, 'Involucrar a los interesados', 4),
    (v_dom_people, 5, 'Alinear las expectativas de los interesados', 5),
    (v_dom_people, 6, 'Gestionar las expectativas de los interesados', 6),
    (v_dom_people, 7, 'Ayudar a garantizar la transferencia de conocimientos', 7),
    (v_dom_people, 8, 'Planificar y gestionar la comunicación', 8)
  on conflict (domain_id, task_number) do nothing;

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 1;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Ayudar a garantizar una visión compartida con los interesados clave.', 1),
    (v_task, 'Promover la visión compartida.', 2),
    (v_task, 'Mantener la visión actualizada.', 3),
    (v_task, 'Desglosar las situaciones para identificar la causa raíz de un malentendido de la visión.', 4);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 2;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar las fuentes de conflicto.', 1),
    (v_task, 'Analizar el contexto del conflicto.', 2),
    (v_task, 'Implementar una estrategia de resolución acordada.', 3),
    (v_task, 'Comunicar los principios de gestión de conflictos con el equipo y los interesados externos.', 4),
    (v_task, 'Establecer un entorno que fomente la adhesión a reglas básicas comunes.', 5),
    (v_task, 'Gestionar y rectificar las infracciones de las reglas básicas.', 6);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 3;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Establecer expectativas para el equipo.', 1),
    (v_task, 'Empoderar al equipo.', 2),
    (v_task, 'Resolver problemas.', 3),
    (v_task, 'Representar la voz del equipo.', 4),
    (v_task, 'Apoyar las diversas experiencias, habilidades y perspectivas del equipo.', 5),
    (v_task, 'Determinar un estilo de liderazgo apropiado.', 6),
    (v_task, 'Establecer roles y responsabilidades claros dentro del equipo.', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 4;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar a los interesados.', 1),
    (v_task, 'Analizar a los interesados.', 2),
    (v_task, 'Analizar y adaptar la comunicación a las necesidades de los interesados.', 3),
    (v_task, 'Ejecutar el plan de involucramiento de los interesados.', 4),
    (v_task, 'Optimizar la alineación entre las necesidades, expectativas de los interesados y objetivos del proyecto.', 5),
    (v_task, 'Generar confianza e influir en los interesados para lograr los objetivos del proyecto.', 6);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 5;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Categorizar a los interesados.', 1),
    (v_task, 'Identificar las expectativas de los interesados.', 2),
    (v_task, 'Facilitar debates para alinear expectativas.', 3),
    (v_task, 'Organizar y actuar en las oportunidades de mentoría.', 4);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 6;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar las expectativas de los clientes internos y externos.', 1),
    (v_task, 'Alinear y mantener los resultados con las expectativas de los clientes internos y externos.', 2),
    (v_task, 'Monitorear la satisfacción o expectativas internas y externas de los clientes y responder según sea necesario.', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 7;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar los conocimientos fundamentales para el proyecto.', 1),
    (v_task, 'Recopilar conocimientos.', 2),
    (v_task, 'Fomentar un entorno para la transferencia de conocimientos.', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_people and task_number = 8;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Definir una estrategia de comunicación.', 1),
    (v_task, 'Promover la transparencia y colaboración.', 2),
    (v_task, 'Establecer un ciclo de retroalimentación.', 3),
    (v_task, 'Comprender los requisitos de presentación de informes.', 4),
    (v_task, 'Crear informes alineados con las expectativas de los patrocinadores y los interesados.', 5),
    (v_task, 'Apoyar los procesos de elaboración de informes y gobernanza.', 6);

  -- =========================================================
  -- DOMINIO II: PROCESO (10 tareas, 64 facilitadores)
  -- =========================================================

  insert into eco_tasks (domain_id, task_number, title, sort_order) values
    (v_dom_process, 1, 'Desarrollar un plan para la dirección del proyecto integrado y planificar la entrega', 1),
    (v_dom_process, 2, 'Desarrollar y gestionar el alcance del proyecto', 2),
    (v_dom_process, 3, 'Ayudar a garantizar una entrega basada en el valor', 3),
    (v_dom_process, 4, 'Planificar y gestionar los recursos', 4),
    (v_dom_process, 5, 'Planificar y gestionar adquisiciones', 5),
    (v_dom_process, 6, 'Planificar y gestionar las finanzas', 6),
    (v_dom_process, 7, 'Planificar y optimizar la calidad de los productos/entregables', 7),
    (v_dom_process, 8, 'Planificar y gestionar el cronograma', 8),
    (v_dom_process, 9, 'Evaluar el estado del proyecto', 9),
    (v_dom_process, 10, 'Gestionar el cierre del proyecto', 10)
  on conflict (domain_id, task_number) do nothing;

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 1;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Evaluar las necesidades, la complejidad y la magnitud del proyecto.', 1),
    (v_task, 'Recomendar un enfoque de desarrollo de dirección de proyectos (es decir, la dirección predictiva, adaptativa/ágil o híbrida).', 2),
    (v_task, 'Determinar los requisitos de información crítica (p. ej., sostenibilidad).', 3),
    (v_task, 'Recomendar una estrategia de ejecución del proyecto.', 4),
    (v_task, 'Crear un plan integrado para la dirección del proyecto.', 5),
    (v_task, 'Calcular el esfuerzo de trabajo y los requisitos de recursos.', 6),
    (v_task, 'Evaluar los planes de proyectos consolidados en busca de dependencias, brechas y valor del negocio continuo.', 7),
    (v_task, 'Mantener el plan para la dirección del proyecto integrado.', 8),
    (v_task, 'Recopilar y analizar los datos para tomar decisiones informadas sobre el proyecto.', 9);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 2;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Definir el alcance.', 1),
    (v_task, 'Obtener el acuerdo de los interesados sobre el alcance del proyecto.', 2),
    (v_task, 'Desglosar el alcance.', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 3;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar los componentes de valor con los interesados clave.', 1),
    (v_task, 'Priorizar el trabajo en función del valor y la retroalimentación de los interesados.', 2),
    (v_task, 'Evaluar las oportunidades para ofrecer valor de forma incremental.', 3),
    (v_task, 'Examinar el valor del negocio a través del proyecto.', 4),
    (v_task, 'Verificar que exista un sistema de medición en vigor para hacer un seguimiento de los beneficios.', 5),
    (v_task, 'Evaluar las opciones de entrega para demostrar el valor.', 6);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 4;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Definir y planificar los recursos en función de los requisitos.', 1),
    (v_task, 'Gestionar y optimizar las necesidades y la disponibilidad de recursos.', 2);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 5;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Planificar las adquisiciones.', 1),
    (v_task, 'Ejecutar un plan de gestión de las adquisiciones.', 2),
    (v_task, 'Seleccionar los tipos de contrato preferidos.', 3),
    (v_task, 'Evaluar el desempeño del proveedor.', 4),
    (v_task, 'Verificar que se cumplan los objetivos del acuerdo de adquisición.', 5),
    (v_task, 'Participar en las negociaciones de acuerdos.', 6),
    (v_task, 'Determinar una estrategia de negociación.', 7),
    (v_task, 'Gestionar proveedores y contratos.', 8),
    (v_task, 'Planificar y gestionar la estrategia de las adquisiciones.', 9),
    (v_task, 'Desarrollar una solución de entrega.', 10);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 6;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Analizar las necesidades financieras del proyecto.', 1),
    (v_task, 'Cuantificar las asignaciones financieras de riesgo y contingencia.', 2),
    (v_task, 'Planificar el seguimiento de los gastos a lo largo del ciclo de vida del proyecto.', 3),
    (v_task, 'Planificar los informes financieros.', 4),
    (v_task, 'Anticipar futuros desafíos financieros.', 5),
    (v_task, 'Monitorear las variaciones financieras y trabajar con el proceso de gobernanza.', 6),
    (v_task, 'Administrar las reservas financieras.', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 7;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Recopilar los requisitos de calidad para los entregables del proyecto.', 1),
    (v_task, 'Planificar procesos y herramientas de calidad.', 2),
    (v_task, 'Ejecutar un plan de gestión de la calidad.', 3),
    (v_task, 'Ayudar a garantizar el cumplimiento de la normativa.', 4),
    (v_task, 'Gestionar el costo de la calidad (CoQ) y la sostenibilidad.', 5),
    (v_task, 'Realizar revisiones de calidad continuas.', 6),
    (v_task, 'Implementar la mejora continua.', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 8;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Preparar un cronograma basado en el enfoque de desarrollo seleccionado.', 1),
    (v_task, 'Coordinar con otros proyectos y operaciones.', 2),
    (v_task, 'Estimar las tareas del proyecto (hitos, dependencias, puntos de historia).', 3),
    (v_task, 'Utilizar puntos de referencia y datos históricos.', 4),
    (v_task, 'Crear un cronograma del proyecto.', 5),
    (v_task, 'Establecer una línea base para el cronograma del proyecto.', 6),
    (v_task, 'Ejecutar un plan de gestión del cronograma.', 7),
    (v_task, 'Analizar la variación del cronograma.', 8);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 9;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Desarrollar métricas, análisis y conciliación de proyectos.', 1),
    (v_task, 'Identificar y adaptar los artefactos necesarios.', 2),
    (v_task, 'Ayudar a garantizar que los artefactos se creen, revisen, actualicen y documenten.', 3),
    (v_task, 'Ayudar a garantizar la accesibilidad de los artefactos.', 4),
    (v_task, 'Evaluar el progreso actual.', 5),
    (v_task, 'Medir, analizar y actualizar las métricas del proyecto.', 6),
    (v_task, 'Comunicar el estado del proyecto.', 7),
    (v_task, 'Evaluar continuamente la eficacia de la gestión de los artefactos.', 8);

  select id into v_task from eco_tasks where domain_id = v_dom_process and task_number = 10;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Obtener la aprobación de los interesados del proyecto para la finalización del proyecto.', 1),
    (v_task, 'Determinar los criterios para cerrar con éxito el proyecto o la fase.', 2),
    (v_task, 'Validar la preparación para la transición (p. ej., al equipo de operaciones o a la siguiente fase).', 3),
    (v_task, 'Finalizar las actividades para cerrar el proyecto o la fase (por ejemplo, lecciones aprendidas finales, retrospectivas, adquisiciones, finanzas, recursos).', 4);

  -- =========================================================
  -- DOMINIO III: ENTORNO DE NEGOCIO (8 tareas, 35 facilitadores)
  -- =========================================================

  insert into eco_tasks (domain_id, task_number, title, sort_order) values
    (v_dom_be, 1, 'Definir y establecer la gobernanza del proyecto', 1),
    (v_dom_be, 2, 'Planificar y gestionar el cumplimiento de proyectos', 2),
    (v_dom_be, 3, 'Gestionar y controlar los cambios', 3),
    (v_dom_be, 4, 'Eliminar impedimentos y gestionar incidentes', 4),
    (v_dom_be, 5, 'Planificar y gestionar el riesgo', 5),
    (v_dom_be, 6, 'Mejora continua', 6),
    (v_dom_be, 7, 'Apoyar el cambio organizacional', 7),
    (v_dom_be, 8, 'Evaluar los cambios en el entorno empresarial externo', 8)
  on conflict (domain_id, task_number) do nothing;

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 1;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Describir y establecer la estructura, las reglas, los procedimientos, los informes, la ética y las políticas mediante el uso de activos de procesos de la organización (OPA).', 1),
    (v_task, 'Definir métricas de éxito.', 2),
    (v_task, 'Describir las vías y los umbrales de escalamiento de la gobernanza.', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 2;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Confirmar los requisitos de cumplimiento del proyecto (por ejemplo, seguridad, salud y seguridad, sostenibilidad, cumplimiento normativo).', 1),
    (v_task, 'Clasificar las categorías de cumplimiento.', 2),
    (v_task, 'Determinar las posibles amenazas para el cumplimiento.', 3),
    (v_task, 'Utilizar métodos para apoyar el cumplimiento.', 4),
    (v_task, 'Analizar las consecuencias del incumplimiento.', 5),
    (v_task, 'Determinar el enfoque y las medidas necesarias para abordar las necesidades de cumplimiento.', 6),
    (v_task, 'Medir el grado de cumplimiento del proyecto.', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 3;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Ejecutar el proceso de control de cambios.', 1),
    (v_task, 'Comunicar el estado de los cambios propuestos.', 2),
    (v_task, 'Implementar los cambios aprobados en el proyecto.', 3),
    (v_task, 'Actualizar la documentación del proyecto para reflejar los cambios.', 4);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 4;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Evaluar el impacto de los impedimentos.', 1),
    (v_task, 'Priorizar y destacar los impedimentos.', 2),
    (v_task, 'Determinar y aplicar una estrategia de intervención para eliminar o minimizar los impedimentos.', 3),
    (v_task, 'Evaluar continuamente para ayudar a garantizar que se estén abordando los impedimentos, los obstáculos y los bloqueos que afectan al equipo.', 4),
    (v_task, 'Reconocer cuando un riesgo se convierte en un incidente.', 5),
    (v_task, 'Colaborar con los interesados pertinentes sobre un enfoque para resolver los incidentes.', 6);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 5;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Identificar los riesgos.', 1),
    (v_task, 'Analizar los riesgos.', 2),
    (v_task, 'Monitorear y controlar los riesgos.', 3),
    (v_task, 'Desarrollar un plan de gestión de los riesgos.', 4),
    (v_task, 'Mantener un registro de riesgos (p. ej., seguridad informática deficiente).', 5),
    (v_task, 'Ejecutar un plan de gestión de los riesgos (p. ej., respuesta a los riesgos para la seguridad y gestión de los riesgos de sostenibilidad).', 6),
    (v_task, 'Comunicar el estado del impacto de un riesgo en el proyecto.', 7);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 6;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Utilizar las lecciones aprendidas.', 1),
    (v_task, 'Ayudar a garantizar que los procesos de mejora continua se actualicen.', 2),
    (v_task, 'Actualizar los activos de los procesos de la organización (OPA).', 3);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 7;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Evaluar la cultura organizacional.', 1),
    (v_task, 'Evaluar el impacto del cambio organizacional en el proyecto y determinar las acciones necesarias.', 2);

  select id into v_task from eco_tasks where domain_id = v_dom_be and task_number = 8;
  insert into eco_enablers (task_id, description, sort_order) values
    (v_task, 'Realizar una encuesta sobre los cambios en el entorno de negocio externo (p. ej., regulaciones, tecnología, geopolítica, mercado).', 1),
    (v_task, 'Evaluar y priorizar el impacto en el alcance/trabajo pendiente del proyecto según los cambios en el entorno de negocio externo.', 2),
    (v_task, 'Revisar continuamente el entorno de negocio externo para determinar si hay impactos en el alcance/trabajo pendiente del proyecto.', 3);

end $$;
