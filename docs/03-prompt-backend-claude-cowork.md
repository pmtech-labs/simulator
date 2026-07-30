# Prompt para Claude Cowork — Backend del Simulador PMP (ECO 2026)

> Pega este bloque como instrucción inicial de la sesión de Cowork. Asume que Cowork tendrá acceso al conector de Supabase y al repositorio `github.com/pmtech-labs/simulator`.

---

Vas a construir el backend de un simulador de examen de certificación PMP® (no afiliado a PMI). Repo: `github.com/pmtech-labs/simulator` (crea la carpeta `backend/` si no existe). Base de datos: proyecto Supabase `crggovgriqnlgyfxkigy`. El frontend se está construyendo en paralelo en Lovable; tu única superficie de contacto con él son las tablas de Supabase y las Edge Functions/RPC que expongas — no construyas UI.

## 1. Primero: aplica el esquema de datos

Toma el documento adjunto `01-especificacion-tecnica-producto.md`, sección 3 ("Esquema de datos Postgres/Supabase"), y aplícalo como migraciones idempotentes en Supabase (usa `supabase migration new` por bloque lógico: taxonomía ECO, banco de contenido, licenciamiento, exámenes, analítica). No lo ejecutes todo en un solo archivo — sepáralo para poder auditar cada migración. Verifica que las políticas RLS queden activas exactamente como se especifica antes de continuar.

Después de aplicar el esquema, siembra (`seed`) las tablas `eco_versions`, `eco_domains`, `eco_tasks` y `eco_enablers` con la taxonomía completa del ECO 2026 que aparece en la sección 1 del mismo documento (3 dominios, 26 tareas, con sus enablers). Esto es contenido de referencia fijo — no debe regenerarse ni depender de un LLM, transcríbelo literalmente a filas.

## 2. Pipeline de generación y validación del banco de preguntas

Necesitamos llegar a 3.500+ ítems (mix ~55-60% standalone, ~30-35% en clusters de caso de 4-5 preguntas, ~10% practicum), calibrados exactamente contra la taxonomía ECO 2026 (nunca contra el PMBOK como texto fuente — el ECO define qué se pregunta, el PMBOK es solo marco conceptual de apoyo).

Construye un pipeline con estas etapas, cada una como función/script independiente y auditable:

1. **Generación asistida por LLM** (usa la API de Anthropic vía tu propia clave de servicio, modelo Claude): dado un `task_id` + sus enablers + un `approach` (predictive/agile/hybrid) + un `format`, genera un borrador de pregunta con: enunciado, opciones, respuesta(s) correcta(s), explicación (rationale), dificultad estimada 1-5. Fuerza salida en JSON estructurado validable contra el esquema de la tabla `questions`. Nunca uses el PMBOK como fuente textual a citar; usa el enabler como contexto de generación.
2. **Validación automática de forma**: script que verifica antes de insertar — JSON válido, exactamente una `task_id` válida, `correct_answer` es subconjunto de `options`, `explanation` no vacía, longitud de enunciado razonable, y ausencia de referencias directas a marcas registradas de PMI fuera del contexto esperado.
3. **Cola de revisión humana**: todo ítem generado entra con `status = 'draft'`. Construye un endpoint/vista simple (puede ser una tabla + query, no hace falta UI todavía) para que un revisor PMP certificado marque `status = 'in_review' → 'approved' → 'published'` y quede registrado en `reviewed_by`/`reviewed_at`. Ningún ítem con `status != 'published'` debe ser servible al frontend.
4. **Balanceo de cobertura**: script de auditoría que reporta, por `task_id`, cuántos ítems `published` existen y compara contra el peso objetivo del dominio (People 33% / Process 41% / Business Environment 26%) y el split predictive 40% / agile+hybrid 60%, para dirigir dónde generar más contenido.

## 3. Motor de generación de examen (Edge Function `start_exam`)

Debe:
- Aceptar `user_id`, `mode` (`full_sim`, `domain_drill`, `case_only`, `custom`), y filtros opcionales (dominios/tareas específicas para drill).
- Para `full_sim`: seleccionar 180 ítems (170 puntuables + 10 no puntuables, pero trátalos igual para el usuario — no reveles cuáles son de prueba) respetando la ponderación 33/41/26 por dominio y 40/60 predictive/agile+hybrid, incluyendo al menos un bloque de `case_cluster` completo (todas sus preguntas hijas consecutivas, sin poder saltarse entre secciones).
- Verificar que el usuario tenga una licencia `active` y no expirada (`licenses.expires_at > now()`) antes de generar el examen; si el plan es `basica_3m`, excluir ítems `format` de tipo practicum avanzado salvo que `plans.includes_practicum_full` sea true para su plan.
- Crear la fila en `exams` y las filas en `exam_items` en el orden correcto (cluster agrupado, resto aleatorizado dentro de su dominio).
- Devolver al frontend solo lo necesario para renderizar (no filtrar `correct_answer` hasta que se envíe la respuesta o termine el examen, según la lógica de corrección que definas: recomiendo corrección al finalizar cada cluster/pregunta individual para dar feedback progresivo, pero nunca antes de que el usuario responda).

## 4. Edge Function `submit_answer` / `finish_exam`

- `submit_answer`: recibe `exam_id`, `question_id`, `user_answer`; calcula `is_correct` comparando contra `correct_answer`; actualiza `exam_items`; actualiza incrementalmente `questions.times_answered`/`times_correct` (para detectar ítems mal calibrados); actualiza `user_task_mastery` para el `task_id` correspondiente.
- `finish_exam`: cierra la sesión, calcula `score_pct` global y por dominio, marca `exams.status = 'completed'`.

## 5. Licenciamiento y pagos

- Integra Stripe (Checkout + Webhooks) para los planes `basica_3m` y `premium_6m` definidos en la tabla `plans`.
- Webhook de Stripe debe crear/actualizar la fila en `licenses` con `expires_at` calculado desde `starts_at + duration_months`.
- Job programado (cron de Supabase o Edge Function con trigger temporal) que marque `licenses.status = 'expired'` cuando corresponda y dispare (vía tabla de eventos o webhook a herramienta de email) la campaña de recompra dirigida cuando el usuario tuvo `mastery_pct` bajo en Business Environment — esa señal ya está en `user_task_mastery`.

## 6. Calidad y observabilidad

- Logs estructurados de cada Edge Function (invocaciones, errores, latencia).
- Test de regresión que verifique, tras cada seed/importación masiva de preguntas, que la cobertura por tarea ECO no quede en cero para ninguna de las 26 tareas — un examen `full_sim` no debe poder generarse si falta contenido `published` en alguna tarea obligatoria.

## Referencia obligatoria

Usa como fuente de verdad para todo el modelo de datos y la taxonomía el documento `01-especificacion-tecnica-producto.md` (secciones 1 y 3). No reinterpretes ni resumas la taxonomía ECO desde tu propio conocimiento — transcríbela literal desde ese documento, ya que proviene del PDF oficial de PMI de julio 2026.
