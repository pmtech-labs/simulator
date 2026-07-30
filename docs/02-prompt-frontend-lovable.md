# Prompt para Lovable — Frontend del Simulador PMP (ECO 2026)

> Copia todo el bloque de abajo (desde "Construye..." hasta el final) directamente en el chat de Lovable. Está escrito para generar el proyecto inicial completo; luego irás iterando pantalla por pantalla con prompts más cortos.

---

Construye una web app de preparación para el examen de certificación PMP®, conectada a un proyecto Supabase ya existente (voy a pegar las credenciales de conexión — usa el conector nativo de Supabase de Lovable, no inventes un backend propio). El backend/lógica de negocio pesada (generación de exámenes, corrección, analítica) se implementará por separado; tu responsabilidad es el frontend y las llamadas a Supabase (tablas y, cuando existan, funciones RPC/Edge Functions).

## Contexto de producto

Es un simulador de examen tipo "no oficial, no afiliado a PMI" (incluye este disclaimer visible en el footer de cada página) dirigido a candidatos a la certificación PMP en España y LATAM. Se diferencia de la competencia (PrepCast, Whizlabs, Simplilearn) porque está calibrado al nuevo Exam Content Outline (ECO) de julio 2026, que introduce:
- Preguntas de opción múltiple simple y múltiple respuesta (clásicas).
- **Clusters de caso**: un escenario largo (texto + posible imagen/gráfico) con 4-5 preguntas vinculadas que se responden en bloque, sin poder retroceder tras terminarlo (igual que en el examen real).
- Ítems "practicum": matching (arrastrar y soltar), point-and-click/hotspot sobre una imagen, preguntas basadas en gráficos, y listas desplegables.

## Modelo de datos (ya existe en Supabase, consúmelo tal cual)

Tablas principales relevantes para el frontend:
- `eco_domains` (id, code, name, weight_pct) — 3 filas: People 33%, Process 41%, Business Environment 26%.
- `eco_tasks` (id, domain_id, task_number, title) — 26 tareas en total.
- `case_clusters` (id, title, scenario_text, media jsonb, primary_domain_id).
- `questions` (id, item_type: standalone|case_child|practicum, format: mc_single|mc_multi|matching|enhanced_matching|graphic_based|hotspot|pulldown, cluster_id, stem, options jsonb, correct_answer jsonb, explanation, task_id, approach: predictive|agile|hybrid, difficulty, practicum_payload jsonb, status).
- `plans` (id, code: basica_3m|premium_6m, name, duration_months, price_cents, includes_analytics, includes_practicum_full, includes_adaptive_engine).
- `licenses` (id, user_id, plan_id, starts_at, expires_at, status).
- `exams` (id, user_id, license_id, mode, config jsonb, total_questions, time_limit_seconds, started_at, finished_at, score_pct, status).
- `exam_items` (id, exam_id, question_id, cluster_id, order_index, user_answer jsonb, is_correct, time_spent_seconds, answered_at).
- `user_task_mastery` (user_id, task_id, attempts, correct, mastery_pct, last_attempt_at).

La autenticación es Supabase Auth (email+password y Google OAuth). Todas las tablas de usuario tienen RLS activo — el frontend solo puede leer/escribir lo del usuario autenticado; para iniciar un examen o corregir respuestas se invoca una función/Edge Function del backend (asume que existirá un endpoint tipo `start_exam` y `submit_answer`, con parámetros que definiremos; deja el punto de integración claro y aislado en un solo archivo de servicio, por ejemplo `services/examService.ts`, para poder ajustarlo fácilmente).

## Pantallas a construir

1. **Landing / Home**
   - Propuesta de valor: "El único simulador PMP calibrado al examen 2026 (ECO nuevo, casos reales, ítems interactivos)".
   - Comparativa breve visual vs. simuladores "genéricos basados en ECO 2021".
   - CTA a registro y a planes/pricing.
   - Disclaimer de no afiliación con PMI, visible pero no invasivo.

2. **Registro / Login** (Supabase Auth: email+password, Google).

3. **Pricing / Planes**
   - Tarjetas para plan Básica (3 meses) y Premium (6 meses), leyendo precios y features desde la tabla `plans`.
   - Tabla comparativa de features (analítica, practicum completo, motor adaptativo).
   - Botón de compra que dispara flujo de checkout (deja un placeholder de integración de pago, tipo Stripe Checkout, como función aislada `services/checkoutService.ts`).

4. **Dashboard del usuario**
   - Estado de la licencia activa (días restantes).
   - Resumen de `mastery_pct` por dominio (People/Process/Business Environment) en forma de barras o radar chart.
   - Últimos exámenes realizados con su score.
   - Accesos directos: "Examen completo", "Práctica por dominio", "Solo casos", "Practicum".

5. **Configuración de examen**
   - Selector de modo: examen completo simulado (180 preguntas / 240 min con la estructura real: bloque de caso → descanso → resto de preguntas → descanso a mitad), práctica por dominio/tarea, solo clusters de caso, o práctica de practicum.
   - Para modo drill: selector múltiple de dominios/tareas específicas (útil para reforzar Business Environment, el dominio nuevo más débil típicamente).

6. **Pantalla de examen (la más importante, cuidado especial aquí)**
   - Debe soportar de forma nativa 4 layouts distintos según `format`:
     a. **mc_single / mc_multi**: enunciado + opciones (radio o checkboxes según corresponda).
     b. **case_child**: panel dividido — a la izquierda el escenario (`scenario_text` + media) fijo y visible durante toda la navegación entre las preguntas hijas de ese cluster; a la derecha la pregunta activa con navegación "Anterior/Siguiente" limitada al propio cluster (no se puede saltar a otra sección sin terminar el bloque).
     c. **matching / enhanced_matching**: dos columnas, drag & drop para emparejar elementos (usa una librería de drag&drop de tu elección, ej. dnd-kit).
     d. **hotspot / graphic_based**: imagen con zonas clicables o overlay interpretativo; construir con coordenadas relativas para que sea responsive.
   - Cronómetro visible (cuenta regresiva), con aviso de los 2 descansos obligatorios de 10 minutos en el examen completo (colocados: el primero justo después del bloque de casos, el segundo a mitad del resto de preguntas).
   - Barra de progreso y navegador de preguntas (grid numerado, con indicador de respondidas/pendientes/marcadas para revisar).
   - Botón "Marcar para revisar".
   - Al enviar: confirmación explícita antes de cerrar el examen.

7. **Resultado del examen**
   - Score global y por dominio (People/Process/Business Environment) comparado contra el peso real del examen (33/41/26).
   - Desglose por approach (predictivo/ágil/híbrido).
   - Listado de preguntas falladas con explicación (`explanation`) y enlace a la tarea ECO correspondiente.
   - CTA contextual: si el usuario es plan Básica y el resultado muestra debilidad marcada en Business Environment, ofrecer upsell a Premium (motor adaptativo + analítica granular).

8. **Analítica / Mi progreso** (solo Premium — mostrar como feature bloqueada con upsell si es Básica)
   - Vista de mastery por cada una de las 26 tareas ECO, no solo por dominio.
   - Recomendación de próxima sesión de estudio basada en las tareas con `mastery_pct` más bajo.
   - Histórico de evolución en el tiempo (line chart).

## Estilo visual

- Tono profesional-ejecutivo, no infantil ni "gamificado" en exceso — la audiencia son directores de proyecto y candidatos senior. Referencia de sobriedad: Linear, Notion, o Stripe Dashboard, no Duolingo.
- Paleta con un color de marca serio (azul marino / grafito) + un acento (ámbar o verde) reservado exclusivamente para estados de correcto/incorrecto y CTAs de conversión, evitando saturar la interfaz.
- Tipografía legible y densa en datos, ya que hay mucha información técnica (dominios, tareas, porcentajes) que debe leerse con claridad, no ocultarse detrás de estética.
- Totalmente responsive — muchos candidatos estudian desde el móvil en trayectos.

## Restricciones técnicas

- No uses `localStorage` para nada que deba persistir entre sesiones o dispositivos (progreso, respuestas) — todo va a Supabase.
- Aísla toda lógica de acceso a datos en una capa de servicios (`services/`), no la mezcles directamente en los componentes, para poder conectar fácilmente los endpoints reales del backend cuando estén listos.
- Deja comentarios `// TODO: backend` en cada punto donde hoy se simula una respuesta pero en producción vendrá de una Edge Function.
