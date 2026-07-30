# Especificación Técnica — Simulador de Examen PMP (ECO 2026)
**Proyecto:** pmtech-labs/simulator
**Versión:** 1.0 — 30 julio 2026
**Stack objetivo:** Backend en Claude Code / Cowork · DB en Supabase (`crggovgriqnlgyfxkigy`) · Frontend en Lovable (con opción futura de despliegue en Vercel)

---

## 0. Resumen ejecutivo

El examen PMP cambió de versión el 9 de julio de 2026 (nuevo ECO, PMBOK 8). Prácticamente todo el inventario de simuladores del mercado (PrepCast, Whizlabs, Simplilearn, Gururo, RMC/Rita Mulcahy) sigue construido sobre el ECO 2021 de 35 tareas y 3 tipos de pregunta (ABCD, multi-respuesta, matching/drag&drop básico). Esto crea una ventana de 6-18 meses donde el mercado hispanohablante no tiene ningún simulador serio calibrado al ECO 2026. Esa es la tesis del proyecto.

### Carencias detectadas en la competencia actual

| Producto | Carencia principal |
|---|---|
| PrepCast PM Exam Simulator (2.000-2.200 preguntas) | Banco calibrado al ECO 2021; sin clusters de caso reales ni ítems gráficos/hotspot. Interfaz replica Pearson VUE pero el *contenido* no refleja el nuevo formato. Reportes de desempeño solo en inglés. |
| Whizlabs / Simplilearn | Preguntas modulares tipo quiz, sin simulación de examen completo con las nuevas secciones (case-study block con su propio bloque de descanso). Feedback genérico, no vinculado a task/enabler específico. |
| Rita Mulcahy / RMC Fast Track | Buen rigor conceptual pero precio alto por acceso anual; en español/portugués la cobertura es limitada y tampoco incorpora practicum/hotspot. |
| Gururo | Banco grande pero foco en repetición, no en diagnóstico por dominio-tarea; poco valor analítico para dirigir el estudio. |
| Oferta en español (aprender21, Marco Calle, etc.) | Son wrappers de contenido de terceros o cursos con quiz simples; ninguno tiene motor de escenario-cluster ni ítems interactivos nativos. |

**Conclusión:** el hueco no es "más preguntas", es (1) arquitectura de ítem compuesta (cluster de caso, practicum con datos/gráficos), (2) calibración exacta al ECO 2026 con trazabilidad task→enabler, y (3) analítica de brecha por dominio/tarea en español nativo, no traducido.

---

## 1. Taxonomía completa ECO 2026 (fuente: PDF oficial PMI, julio 2026)

Esta taxonomía es la columna vertebral de la base de datos: **todo ítem del banco debe etiquetarse contra un `task_id`** (y opcionalmente enablers específicos). 3 dominios, 26 tareas totales (8 People + 10 Process + 8 Business Environment).

### DOMINIO I — PEOPLE (33%)

| # | Task | Enablers (ejemplos ilustrativos, no exhaustivos) |
|---|---|---|
| 1 | Desarrollar una visión común | Asegurar visión compartida con interesados clave · Promover la visión · Mantenerla vigente · Diagnosticar malentendidos de la visión |
| 2 | Gestionar conflictos | Identificar fuentes de conflicto · Analizar contexto · Implementar estrategia de resolución acordada · Comunicar principios de gestión de conflicto · Establecer entorno de reglas comunes · Corregir violaciones de reglas |
| 3 | Liderar al equipo de proyecto | Establecer expectativas a nivel de equipo · Empoderar al equipo · Resolver problemas · Representar la voz del equipo · Apoyar diversidad de experiencia/habilidades · Determinar estilo de liderazgo apropiado · Establecer roles y responsabilidades claros |
| 4 | Involucrar a los interesados | Identificar interesados · Analizarlos · Adaptar comunicación a sus necesidades · Ejecutar plan de involucramiento · Optimizar alineación entre necesidades/expectativas y objetivos · Generar confianza e influencia |
| 5 | Alinear expectativas de los interesados | Categorizar interesados · Identificar sus expectativas · Facilitar discusiones de alineación · Gestionar oportunidades de mentoría |
| 6 | Gestionar expectativas de los interesados | Identificar expectativas de clientes internos/externos · Alinear y mantener resultados según esas expectativas · Monitorear satisfacción y responder |
| 7 | Ayudar a garantizar la transferencia de conocimiento | Identificar conocimiento crítico del proyecto · Recolectar conocimiento · Fomentar entorno de transferencia |
| 8 | Planificar y gestionar la comunicación | Definir estrategia de comunicación · Promover transparencia y colaboración · Establecer bucle de retroalimentación · Entender requisitos de reporte · Crear reportes alineados con patrocinadores · Soportar procesos de gobernanza |

### DOMINIO II — PROCESS (41%)

| # | Task | Enablers (resumen) |
|---|---|---|
| 1 | Desarrollar el plan integrado de gestión y planificar la entrega | Evaluar necesidad/complejidad/magnitud · Recomendar enfoque (predictivo/ágil/híbrido) · Determinar requisitos de información crítica (p. ej. sostenibilidad) · Recomendar estrategia de ejecución · Crear plan integrado · Estimar esfuerzo y recursos · Evaluar dependencias/brechas/valor de negocio continuado · Mantener el plan · Analizar datos para decisiones informadas |
| 2 | Desarrollar y gestionar el alcance del proyecto | Definir alcance · Obtener acuerdo de interesados · Descomponer el alcance |
| 3 | Ayudar a garantizar la entrega basada en valor | Identificar componentes de valor con interesados clave · Priorizar trabajo por valor y feedback · Evaluar entrega incremental · Examinar valor de negocio durante el proyecto · Verificar sistema de medición de beneficios · Evaluar opciones de entrega |
| 4 | Planificar y gestionar recursos | Definir/planificar recursos según requisitos · Optimizar necesidad y disponibilidad de recursos |
| 5 | Planificar y gestionar adquisiciones | Planificar adquisiciones · Ejecutar plan · Seleccionar tipo de contrato preferido · Evaluar desempeño de proveedores · Verificar cumplimiento de objetivos del acuerdo · Participar en negociaciones · Determinar estrategia de negociación · Gestionar proveedores y contratos · Desarrollar solución de entrega |
| 6 | Planificar y gestionar finanzas | Analizar necesidades financieras · Cuantificar riesgo y contingencia · Planificar seguimiento de gasto · Planificar reporte financiero · Anticipar retos financieros futuros · Monitorear variaciones y gobernanza · Gestionar reservas |
| 7 | Planificar y optimizar la calidad de productos/entregables | Recolectar requisitos de calidad · Planificar procesos/herramientas de calidad · Ejecutar plan de calidad · Garantizar cumplimiento regulatorio · Gestionar costo de calidad (CoQ) y sostenibilidad · Conducir revisiones continuas · Implementar mejora continua |
| 8 | Planificar y gestionar el cronograma | Preparar cronograma según enfoque elegido · Coordinar con otros proyectos/operaciones · Estimar tareas (hitos, dependencias, story points) · Usar benchmarks y datos históricos · Crear y establecer línea base · Ejecutar plan de cronograma · Analizar variación |
| 9 | Evaluar el estado del proyecto | Desarrollar métricas/análisis/reconciliación · Identificar y adaptar artefactos necesarios · Garantizar creación/revisión/actualización de artefactos · Garantizar accesibilidad · Evaluar progreso actual · Medir y actualizar métricas · Comunicar estado · Evaluar efectividad de la gestión de artefactos |
| 10 | Gestionar el cierre del proyecto | Obtener aprobación de interesados · Determinar criterios de cierre · Validar preparación para transición · Concluir actividades de cierre (lecciones aprendidas, retrospectivas, adquisiciones, financiero, recursos) |

### DOMINIO III — BUSINESS ENVIRONMENT (26%)

| # | Task | Enablers (resumen) |
|---|---|---|
| 1 | Definir y establecer la gobernanza del proyecto | Describir/establecer estructura, reglas, procedimientos, reporte, ética y políticas usando OPAs · Definir métricas de éxito · Delimitar rutas y umbrales de escalamiento |
| 2 | Planificar y gestionar el cumplimiento del proyecto | Confirmar requisitos de cumplimiento (seguridad, salud/seguridad, sostenibilidad, regulatorio) · Clasificar categorías de cumplimiento · Determinar amenazas potenciales · Usar métodos de soporte al cumplimiento · Analizar consecuencias de incumplimiento · Determinar enfoque/acciones · Medir grado de cumplimiento |
| 3 | Gestionar y controlar cambios | Ejecutar el proceso de control de cambios · Comunicar estado de cambios propuestos · Implementar cambios aprobados · Actualizar documentación |
| 4 | Eliminar impedimentos y gestionar incidencias | Evaluar impacto de impedimentos · Priorizarlos/destacarlos · Determinar/aplicar estrategia de intervención · Reevaluar continuamente · Reconocer cuándo un riesgo se convierte en incidencia · Colaborar con interesados en la resolución |
| 5 | Planificar y gestionar el riesgo | Identificar riesgos · Analizarlos · Monitorear y controlar · Desarrollar plan de gestión de riesgos · Mantener registro de riesgos (p. ej. seguridad IT deficiente) · Ejecutar plan (respuesta de riesgo de seguridad y sostenibilidad) · Comunicar estado del impacto |
| 6 | Mejora continua | Utilizar lecciones aprendidas · Garantizar actualización de procesos de mejora continua · Actualizar OPAs |
| 7 | Apoyar el cambio organizacional | Evaluar cultura organizacional · Evaluar impacto del cambio organizacional en el proyecto y determinar acciones |
| 8 | Evaluar cambios del entorno empresarial externo | Monitorear cambios externos (regulación, tecnología, geopolítica, mercado) · Evaluar y priorizar impacto en alcance/backlog · Revisar continuamente el entorno externo |

**Corte transversal obligatorio para etiquetado de cada ítem** (independiente del dominio/tarea):
- `approach`: `predictive` | `agile` | `hybrid` — distribución objetivo del banco: 40% predictive / 60% agile+hybrid combinados, replicando la distribución real del examen.
- `focus_tags` (opcional, multivalor): `ai`, `sustainability`, `value_delivery` — temas transversales nuevos del ECO 2026 que deben aparecer entretejidos en preguntas de los tres dominios, no aislados.

---

## 2. Tipos de ítem que el motor debe soportar

Fuente: PDF oficial ECO 2026, sección "PMP Certification Exam Question Types". Son 7 formatos:

1. **Multiple-choice single response** — clásico ABCD, una correcta.
2. **Multiple-response** — varias opciones correctas.
3. **Case or Scenario (NUEVO)** — un escenario extenso (texto + posibles gráficos/tablas) con **varias preguntas vinculadas** (cluster). Aparece en un bloque propio del examen, con su propio descanso después.
4. **Enhanced Matching** — arrastrar elementos a ubicaciones en un diagrama/imagen.
5. **Graphic-Based (NUEVO)** — interpretar un gráfico/diagrama/imagen y responder preguntas sobre él.
6. **Point and Click (Hotspot)** — clic sobre zonas ocultas de una imagen.
7. **Matching** — emparejar columnas.
8. **Pull-down list** — selección de respuesta desde un desplegable.

Para el MVP, prioriza en este orden de esfuerzo/impacto:
1. Multiple-choice / multiple-response (base del banco, ~55-60%)
2. Case/Scenario clusters (el diferenciador competitivo real, ~25-30%)
3. Matching + Pull-down (relativamente baratos de implementar en React)
4. Graphic-based + Point-and-click/Hotspot (mayor inversión de UI, dejar para v1.1 si hace falta acelerar el lanzamiento)

---

## 3. Esquema de datos (Postgres / Supabase)

Diseño relacional pensado para: (a) trazabilidad total ítem→task→enabler, (b) soporte nativo de clusters de caso y practicum sin forzar el modelo de pregunta simple, (c) versionado del banco ante futuros cambios de ECO, (d) licenciamiento por planes y (e) analítica de brecha por dominio/tarea.

```sql
-- =========================================================
-- 1. TAXONOMÍA ECO (referencia, se siembra una sola vez)
-- =========================================================
create table eco_versions (
  id uuid primary key default gen_random_uuid(),
  label text not null,               -- 'ECO 2026'
  effective_date date not null,      -- '2026-07-09'
  is_active boolean default true
);

create table eco_domains (
  id uuid primary key default gen_random_uuid(),
  eco_version_id uuid references eco_versions(id) on delete cascade,
  code text not null,                 -- 'people' | 'process' | 'business_environment'
  name text not null,
  weight_pct numeric(5,2) not null,   -- 33.00 / 41.00 / 26.00
  sort_order int not null
);

create table eco_tasks (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references eco_domains(id) on delete cascade,
  task_number int not null,           -- 1..8 / 1..10 / 1..8
  title text not null,
  sort_order int not null,
  unique (domain_id, task_number)
);

create table eco_enablers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references eco_tasks(id) on delete cascade,
  description text not null,
  sort_order int not null
);

-- =========================================================
-- 2. BANCO DE CONTENIDO
-- =========================================================
create type item_type as enum ('standalone', 'case_child', 'practicum');
create type item_format as enum (
  'mc_single', 'mc_multi', 'matching', 'enhanced_matching',
  'graphic_based', 'hotspot', 'pulldown'
);
create type approach_type as enum ('predictive', 'agile', 'hybrid');
create type item_status as enum ('draft', 'in_review', 'approved', 'published', 'retired');

-- Escenario padre para clusters de caso (Case/Scenario)
create table case_clusters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scenario_text text not null,
  media jsonb default '[]',           -- [{type:'image'|'chart', url, alt}]
  primary_domain_id uuid references eco_domains(id),
  status item_status default 'draft',
  eco_version_id uuid references eco_versions(id),
  created_by uuid,                    -- auth.users.id del redactor
  reviewed_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla principal de ítems (standalone, hijos de cluster, o practicum)
create table questions (
  id uuid primary key default gen_random_uuid(),
  item_type item_type not null default 'standalone',
  format item_format not null default 'mc_single',
  cluster_id uuid references case_clusters(id) on delete cascade, -- null si standalone
  stem text not null,                  -- enunciado
  options jsonb not null,              -- [{id:'A', text:'...'}]
  correct_answer jsonb not null,       -- ['B'] o ['A','C'] para multi-respuesta
  explanation text not null,           -- rationale obligatorio (aporta valor y defensa de calidad)
  task_id uuid references eco_tasks(id) not null,
  enabler_ids uuid[] default '{}',     -- referencias opcionales a eco_enablers.id
  approach approach_type not null,
  focus_tags text[] default '{}',      -- 'ai','sustainability','value_delivery'
  difficulty smallint check (difficulty between 1 and 5) default 3,
  practicum_payload jsonb,             -- solo si format requiere datos extra (coords hotspot, pares matching, dataset gráfico)
  status item_status default 'draft',
  eco_version_id uuid references eco_versions(id),
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- calidad/telemetría agregada (recalculada por trigger o job)
  times_answered int default 0,
  times_correct int default 0
);

create index idx_questions_task on questions(task_id);
create index idx_questions_cluster on questions(cluster_id);
create index idx_questions_status on questions(status);

-- =========================================================
-- 3. LICENCIAMIENTO / PLANES
-- =========================================================
create type plan_code as enum ('basica_3m', 'premium_6m');

create table plans (
  id uuid primary key default gen_random_uuid(),
  code plan_code not null unique,
  name text not null,
  duration_months int not null,
  price_cents int not null,
  currency text default 'EUR',
  includes_analytics boolean default false,
  includes_practicum_full boolean default false,
  includes_adaptive_engine boolean default false
);

create table licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references plans(id),
  starts_at timestamptz default now(),
  expires_at timestamptz not null,
  status text default 'active',       -- active | expired | cancelled
  stripe_subscription_id text,
  created_at timestamptz default now()
);

create index idx_licenses_user on licenses(user_id);

-- =========================================================
-- 4. SESIONES DE EXAMEN Y RESPUESTAS
-- =========================================================
create type exam_mode as enum ('full_sim', 'domain_drill', 'case_only', 'custom');

create table exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  license_id uuid references licenses(id),
  mode exam_mode not null default 'full_sim',
  config jsonb default '{}',          -- filtros usados para generar el examen
  total_questions int not null,
  time_limit_seconds int,
  started_at timestamptz default now(),
  finished_at timestamptz,
  score_pct numeric(5,2),
  status text default 'in_progress'   -- in_progress | completed | abandoned
);

create table exam_items (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id) on delete cascade,
  question_id uuid references questions(id),
  cluster_id uuid references case_clusters(id),
  order_index int not null,
  user_answer jsonb,
  is_correct boolean,
  time_spent_seconds int,
  answered_at timestamptz
);

create index idx_exam_items_exam on exam_items(exam_id);

-- =========================================================
-- 5. ANALÍTICA DE BRECHA (materializada, recalculada por job/trigger)
-- =========================================================
create table user_task_mastery (
  user_id uuid references auth.users(id) on delete cascade,
  task_id uuid references eco_tasks(id) on delete cascade,
  attempts int default 0,
  correct int default 0,
  mastery_pct numeric(5,2) generated always as
    (case when attempts = 0 then 0 else round(100.0 * correct / attempts, 2) end) stored,
  last_attempt_at timestamptz,
  primary key (user_id, task_id)
);

-- =========================================================
-- RLS (Row Level Security) — obligatorio en Supabase
-- =========================================================
alter table exams enable row level security;
alter table exam_items enable row level security;
alter table licenses enable row level security;
alter table user_task_mastery enable row level security;

create policy "usuarios ven solo sus examenes"
  on exams for select using (auth.uid() = user_id);
create policy "usuarios ven solo sus licencias"
  on licenses for select using (auth.uid() = user_id);
create policy "usuarios ven solo su mastery"
  on user_task_mastery for select using (auth.uid() = user_id);
-- questions, eco_*, case_clusters: lectura pública (published), escritura solo rol admin/service_role
```

### Notas de diseño clave

- **Clusters de caso**: un `case_cluster` es padre de N `questions` con `item_type = 'case_child'`. El motor de generación de examen debe tratar el cluster como unidad atómica: si entra una pregunta del cluster, entran todas sus hermanas, consecutivas, y cuentan como bloque para el descanso (igual que en el examen real, que pone el primer descanso justo después del bloque de caso).
- **`practicum_payload` (jsonb)**: evita crear una tabla por cada subtipo de practicum. Ejemplos de forma:
  - Hotspot: `{"image_url":..., "hotspots":[{"id":"a","x":120,"y":80,"w":40,"h":40,"correct":true}]}`
  - Matching: `{"left":[{"id":"l1","label":"Riesgo"}], "right":[{"id":"r1","label":"Transferir"}], "correct_pairs":[["l1","r1"]]}`
  - Graphic-based: `{"chart_type":"burndown","dataset":{...}, "question_focus":"identify_variance_point"}`
- **Versionado (`eco_versions`)**: cuando PMI actualice el ECO otra vez (~2029-2030), no se borra nada; se crea una nueva fila en `eco_versions` y se remapea el banco. Esto también te permite ofrecer "modo legado" si algún cliente corporativo lo pidiera.
- **`times_answered` / `times_correct` en `questions`**: telemetría agregada a nivel de ítem — te permite detectar preguntas mal calibradas (ej. 95% de acierto = demasiado fácil, o correlación negativa con el resultado general = pregunta ambigua/mal escrita) sin tener que escanear `exam_items` cada vez.

---

## 4. Modelo de pricing y proyección de LTV

### 4.1 Estructura de planes (ajuste sobre tu propuesta inicial)

| Plan | Duración | Incluye | Precio sugerido (EUR) |
|---|---|---|---|
| **Básica** | 3 meses | Banco completo de preguntas standalone + clusters de caso, exámenes completos ilimitados, resultado por dominio | 49 € |
| **Premium** | 6 meses | Todo lo anterior + banco practicum completo (hotspot/graphic/matching avanzado) + analítica de brecha por task/enabler + motor adaptativo (prioriza tasks con menor `mastery_pct`) + reportes descargables | 89 € |

Referencia de mercado: PrepCast cobra 90 días de acceso a ~720-2.200 preguntas en el rango de $129-179; RMC/Rita Mulcahy con acceso anual ronda $150-250. Tu punto de entrada (49-89 €) es competitivo para LATAM/España sin ser el más barato del mercado — la diferenciación es calibración ECO 2026 + analítica, no precio.

**Recomendación de ajuste**: no diferencies solo por duración. La palanca de valor real es la analítica adaptativa — muévela a Premium como está, pero considera un tercer escalón futuro (`Premium+` o add-on) con sesiones de mentoría/corrección humana, aprovechando que ya tienes infraestructura de formación híbrida.

### 4.2 Proyección de LTV (supuestos de partida — ajustar con datos reales tras el primer trimestre)

| Variable | Supuesto inicial |
|---|---|
| Precio medio ponderado (mix 60% básica / 40% premium) | 49×0.6 + 89×0.4 = **65,0 €** |
| Tasa de upsell básica→premium (dentro de los 3 meses) | 15% |
| Tasa de recompra (repite tras expirar, ej. suspendió el examen) | 20% |
| Coste variable por licencia (hosting, Stripe ~2.9%+0.30€, soporte) | ~6 € |
| CAC estimado (paid social + SEO/contenido, ajustar con datos de Certypass/MusicDibs si hay canal compartido) | 25-40 € (placeholder — validar con benchmarks de tu propio funnel) |

**LTV simplificado por cohorte de 100 usuarios (básica inicial):**

```
100 usuarios × 49 €                         = 4.900 €
+ 15 upsell a premium (89-49=40€ adicional) =   600 €
+ 20 recompras (a 49€ media)                =   980 €
────────────────────────────────────────────────────
Ingreso total cohorte                       = 6.480 €
LTV medio por usuario inicial               = 64,8 €
Coste variable (100+15+20 licencias × 6€)   =   810 €
Margen bruto cohorte                        = 5.670 €
LTV neto medio                              ≈ 56,7 € / usuario
```

Con un CAC de 25-40 €, el ratio LTV:CAC queda en **1,4x–2,3x** — funcional pero no holgado para este pricing. Dos palancas para mejorarlo sin tocar producto:
1. **Bundle cruzado** con tu programa híbrido de 35 horas (ya lo mencionas en el cierre comercial de la newsletter) — sube el ticket medio real de conversión sin aumentar CAC.
3. **Ventana de recompra dirigida**: si el simulador detecta `mastery_pct` bajo en Business Environment (el dominio que triplicó peso, donde más gente fallará por estudiar con material viejo), dispara oferta de recompra automatizada al expirar — ya tienes la señal en `user_task_mastery`.

### 4.3 Métricas a instrumentar desde el día 1 (no opcional)

- Conversión landing→registro→compra (funnel Lovable + Stripe/checkout).
- % de usuarios que completan al menos 1 examen full-sim (proxy de activación).
- `mastery_pct` medio por dominio a nivel agregado — esto también es tu contenido de marketing (ej. "el 68% de los usuarios falla Business Environment en el primer intento", dato real para la newsletter PMP).
- Tasa de expiración sin recompra vs. con recompra.

---

## 5. Roadmap sugerido (MVP → v1.1)

**MVP (objetivo: banco funcional + examen completo, sin practicum avanzado)**
1. Seed de taxonomía ECO 2026 completa (Sección 1 de este documento → tablas `eco_*`).
2. 1.500-2.000 preguntas standalone + 150-200 clusters de caso (4-5 preguntas c/u ≈ 700-900 ítems) — total ~2.200-2.900, suficiente para lanzar y seguir creciendo hacia 3.500.
3. Motor de generación de examen: selecciona por dominio ponderado (33/41/26), respeta approach 40/60, agrupa clusters como bloque atómico.
4. Licenciamiento básico + Stripe.
5. Resultado por dominio (no aún por task granular).

**v1.1**
1. Practicum completo (hotspot, graphic-based, matching avanzado).
2. Analítica `user_task_mastery` + motor adaptativo.
3. Panel de administración de contenido (revisión/aprobación de preguntas, versionado).
4. Expansión a 3.500+ ítems.

---

## 6. Riesgos y consideraciones legales

- **Marca registrada**: PMP® y PMBOK® son marcas de PMI. El producto y toda comunicación deben incluir disclaimer explícito de no afiliación ("Producto no afiliado ni respaldado por PMI"). No usar el logo de PMI ni sugerir "examen oficial".
- **Calidad/responsabilidad de contenido**: cada pregunta debe pasar por revisión humana de un PMP certificado antes de `status = 'published'`. El campo `reviewed_by` no es decorativo — es tu defensa ante reclamos de calidad.
- **Trazabilidad ECO**: mantener `eco_version_id` en cada ítem permite demostrar (a clientes B2B o auditorías) que el banco está calibrado a la versión vigente del examen, no a una genérica "PMBOK".
