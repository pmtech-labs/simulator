-- =========================================================
-- 0027: Glosario de terminos + tabla glossary_terms
--
-- Inspirado en el glosario buscable que vimos en el simulador de Pablo Lledo, pero
-- con definiciones redactadas completamente de cero -- ninguna copiada de PMBOK ni
-- de ninguna fuente con copyright, precisamente para evitar cualquier problema de
-- propiedad intelectual con contenido que sí tiene derechos de autor.
--
-- Lectura publica (anon + authenticated): es contenido de referencia general, no son
-- preguntas de examen ni respuestas, y sirve como valor añadido incluso antes de
-- registrarse (y potencialmente para SEO en el futuro).
-- =========================================================

create table if not exists glossary_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  definition text not null,
  category text not null check (category in ('predictive', 'agile', 'general')),
  created_at timestamptz not null default now()
);

alter table glossary_terms enable row level security;

create policy "lectura publica del glosario" on glossary_terms
  for select to anon, authenticated
  using (true);

create policy "escritura solo service_role glosario" on glossary_terms
  for all using (auth.role() = 'service_role');

comment on table glossary_terms is
  'Glosario de terminos de gestion de proyectos, redactado de forma original (no
   copiado de PMBOK ni de ninguna fuente con copyright) para evitar problemas de
   propiedad intelectual. Contenido de referencia general, de lectura publica.';

insert into glossary_terms (term, definition, category) values
('Interesado (stakeholder)', 'Cualquier persona, grupo u organización que puede afectar o verse afectado por las decisiones, actividades o el resultado de un proyecto.', 'general'),
('Ciclo de vida del proyecto', 'La serie de fases por las que pasa un proyecto desde su inicio hasta su cierre.', 'general'),
('Entregable', 'Cualquier producto, resultado o capacidad único y verificable que se produce para completar un proceso, fase o proyecto.', 'general'),
('Línea base', 'La versión aprobada de un plan (alcance, cronograma o costes) que sirve de referencia para medir el desempeño real.', 'general'),
('Riesgo', 'Un evento o condición incierta que, si ocurre, tiene un efecto positivo o negativo sobre uno o más objetivos del proyecto.', 'general'),
('Acta de constitución del proyecto', 'El documento que autoriza formalmente la existencia de un proyecto y otorga al director de proyecto autoridad para usar recursos.', 'general'),
('Registro de interesados', 'Documento que identifica a los interesados del proyecto junto con información relevante sobre ellos: intereses, influencia y expectativas.', 'general'),
('Gobernanza del proyecto', 'El marco de funciones, responsabilidades y procesos de toma de decisiones que guían la dirección del proyecto.', 'general'),
('Ruta crítica', 'La secuencia de actividades que determina la duración mínima posible del proyecto; cualquier retraso en ella retrasa el proyecto entero.', 'predictive'),
('Holgura total', 'El tiempo que una actividad puede retrasarse sin afectar la fecha de fin del proyecto.', 'predictive'),
('Valor ganado (EV)', 'El valor del trabajo realmente completado, expresado en términos del presupuesto aprobado para ese trabajo.', 'predictive'),
('Valor planificado (PV)', 'El presupuesto autorizado asignado al trabajo programado hasta un momento dado.', 'predictive'),
('Costo real (AC)', 'El costo realmente incurrido por el trabajo ya realizado.', 'predictive'),
('Variación del cronograma (SV)', 'La diferencia entre el valor ganado y el valor planificado (SV = EV − PV); indica si el proyecto va adelantado o atrasado.', 'predictive'),
('Variación del costo (CV)', 'La diferencia entre el valor ganado y el costo real (CV = EV − AC); indica si el proyecto está por debajo o por encima de presupuesto.', 'predictive'),
('Índice de desempeño del cronograma (SPI)', 'La razón entre el valor ganado y el valor planificado (SPI = EV / PV); un valor menor que 1 indica retraso.', 'predictive'),
('Índice de desempeño del costo (CPI)', 'La razón entre el valor ganado y el costo real (CPI = EV / AC); un valor menor que 1 indica sobrecoste.', 'predictive'),
('Estructura de desglose del trabajo (EDT)', 'Una descomposición jerárquica del alcance total del trabajo del proyecto en componentes más pequeños y manejables.', 'predictive'),
('Diagrama de red del cronograma', 'Representación gráfica de las relaciones lógicas entre las actividades del cronograma del proyecto.', 'predictive'),
('Método de la ruta crítica (CPM)', 'Técnica que calcula las fechas teóricas de inicio y fin más tempranas y más tardías de cada actividad para determinar la ruta crítica.', 'predictive'),
('Reserva de contingencia', 'Tiempo o presupuesto reservado dentro de la línea base para atender riesgos identificados y aceptados.', 'predictive'),
('Reserva de gestión', 'Presupuesto o tiempo reservado para trabajo no previsto dentro del alcance del proyecto, fuera de la línea base.', 'predictive'),
('Adquisiciones (procurement)', 'El proceso de obtener bienes o servicios de fuera del equipo del proyecto.', 'predictive'),
('Sprint', 'Un periodo de tiempo fijo y corto (normalmente de 1 a 4 semanas) durante el cual un equipo Scrum crea un incremento de producto potencialmente entregable.', 'agile'),
('Backlog del producto', 'Una lista ordenada y priorizada de todo lo que se necesita en el producto, gestionada por el Product Owner.', 'agile'),
('Historia de usuario', 'Una descripción breve e informal de una funcionalidad, escrita desde la perspectiva de quien la usará.', 'agile'),
('Retrospectiva', 'Una reunión al final de cada iteración donde el equipo reflexiona sobre cómo trabajó y busca mejoras para el siguiente ciclo.', 'agile'),
('Daily standup', 'Reunión breve y diaria donde el equipo sincroniza su trabajo y detecta impedimentos.', 'agile'),
('Velocidad (velocity)', 'La cantidad de trabajo que un equipo ágil completa en promedio por iteración, usada para estimar el ritmo futuro.', 'agile'),
('Kanban', 'Método visual de gestión del flujo de trabajo que limita el trabajo en curso para mejorar la entrega continua.', 'agile'),
('Trabajo en curso (WIP)', 'Los elementos que un equipo está trabajando activamente en un momento dado; limitarlo mejora el flujo.', 'agile'),
('Definición de terminado (Definition of Done)', 'El conjunto de criterios que un incremento de trabajo debe cumplir para considerarse completo.', 'agile'),
('Product Owner', 'El rol responsable de maximizar el valor del producto y de gestionar el backlog del producto.', 'agile'),
('Scrum Master', 'El rol responsable de facilitar el proceso Scrum y eliminar impedimentos que afectan al equipo.', 'agile'),
('Entrega continua', 'La práctica de mantener el software en un estado listo para ser lanzado en cualquier momento.', 'agile'),
('Refinamiento del backlog', 'La actividad continua de detallar, estimar y priorizar los elementos del backlog del producto.', 'agile'),
('Punto de historia (story point)', 'Una unidad relativa usada para estimar el esfuerzo o la complejidad de una historia de usuario.', 'agile'),
('Matriz de poder/interés', 'Herramienta para clasificar a los interesados según su nivel de influencia y su interés en el proyecto.', 'general'),
('Registro de riesgos', 'Documento donde se registran los riesgos identificados, su análisis y las respuestas planificadas.', 'general'),
('Plan de gestión de comunicaciones', 'Documento que describe cómo, cuándo y con qué frecuencia se comunicará la información del proyecto.', 'general'),
('Mentoría', 'Acompañamiento individual y sostenido de un profesional experimentado a otro para transferir conocimiento y experiencia.', 'general'),
('Lecciones aprendidas', 'El conocimiento adquirido durante un proyecto, documentado para beneficiar a proyectos futuros.', 'general'),
('Costo de la calidad (COQ)', 'El costo total de las acciones de prevención y evaluación, más el costo de los fallos internos y externos.', 'predictive'),
('Gestión del valor ganado (EVM)', 'Técnica que integra alcance, cronograma y costo para medir el desempeño y avance del proyecto de forma objetiva.', 'predictive'),
('Enfoque híbrido', 'Combinación de elementos predictivos y ágiles en un mismo proyecto, adaptando el método a las necesidades reales de cada fase o componente.', 'general')
on conflict (term) do nothing;
