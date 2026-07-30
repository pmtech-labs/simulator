# Prompt para Lovable — Panel de Superadmin (`/admin`)

> Pega esto en el chat de Lovable dentro del MISMO proyecto donde ya está construido el frontend público
> (prompt `02-prompt-frontend-lovable.md`). No es una app nueva: es una sección adicional protegida por rol.

---

Añade una sección de administración en `/admin` a la app existente del simulador PMP. Esta sección es
para uso interno del equipo (gestión del banco de preguntas y de los LLM usados para generarlas), separada
por completo de la experiencia del candidato PMP. Usa el mismo proyecto Supabase ya conectado.

## Control de acceso

- Cualquier ruta bajo `/admin/*` debe comprobar, tras el login, si el usuario autenticado es admin.
- La comprobación se hace invocando el RPC `is_admin` de Supabase con el `uid()` del usuario actual
  (ya existe en la base de datos, devuelve `true`/`false`). Si devuelve `false` o el usuario no está
  autenticado, redirige a la home pública — no muestres ni un parpadeo de la UI de admin antes de confirmar.
- No añadas un botón visible de "ir a /admin" en la navegación pública; es una ruta que solo conocen quienes
  la necesitan (seguridad por oscuridad no es suficiente por sí sola, pero el control de acceso real ya está
  en el backend vía RLS y la comprobación `is_admin` en cada Edge Function).

## Modelo de datos relevante para esta sección (ya existe en Supabase)

- `llm_connectors` (id, name, provider, model_id, api_base_url, is_active, created_at) — la API key NUNCA
  viaja al frontend; se gestiona solo en el backend (Vault). El formulario de alta envía la key una sola vez
  al crearlo y nunca se vuelve a mostrar.
- `generation_jobs` (id, connector_id, requested_by, task_ids[], approach, format, count_requested,
  difficulty_min/max, focus_tags[], status, count_generated, count_failed, error_message, created_at,
  started_at, completed_at).
- `questions` (con `status`: draft | in_review | approved | published | retired).
- `v_task_coverage`, `v_question_stats`, `v_exam_stats` — vistas de solo lectura para el dashboard.
- `eco_domains` / `eco_tasks` / `eco_enablers` — para poblar los selectores de dominio/tarea.

Las Edge Functions ya desplegadas que debes consumir (todas requieren el JWT del usuario admin en el header
`Authorization: Bearer <token>`, Supabase lo gestiona automáticamente si usas el cliente ya configurado):

- `GET/POST/DELETE admin_connectors` — listar, crear (con `api_key` en el body), desactivar conectores.
- `GET/POST admin_generation_jobs` — listar jobs, crear y ejecutar un job nuevo.
- `PATCH/DELETE admin_questions` — cambiar estado de preguntas, retirar o borrar.
- `GET admin_stats?view=coverage|hardest_questions|most_used_questions|exams` — datos para el dashboard.

## Pantallas a construir dentro de `/admin`

### 1. `/admin` — Dashboard general
- KPI cards arriba: total de preguntas por estado (draft/in_review/approved/published/retired), total de
  exámenes realizados (`v_exam_stats`), cobertura de las 26 tareas ECO (cuántas tienen ≥1 pregunta publicada
  vs. cuántas están en cero — usa `v_task_coverage`, resáltalo en rojo si hay tareas en 0).
- Gráfico de barras: preguntas publicadas por dominio (People/Process/Business Environment) comparado contra
  el peso objetivo del examen (33/41/26%), para ver de un vistazo si el banco está desbalanceado.
- Tabla "Preguntas más falladas" (`admin_stats?view=hardest_questions`): stem truncado, dominio, tarea,
  `success_rate_pct`, `times_answered`. Útil para detectar preguntas mal calibradas o simplemente difíciles.
- Tabla "Preguntas más usadas" (`admin_stats?view=most_used_questions`): mismas columnas pero ordenadas por
  `times_used_in_exams` — candidatas a rotar/retirar si llevan demasiado tiempo circulando.

### 2. `/admin/connectors` — Gestión de conectores LLM
- Tabla de conectores existentes: nombre, proveedor, modelo, activo/inactivo, fecha de creación. NUNCA se
  muestra la API key, ni siquiera parcialmente enmascarada — una vez guardada, es de solo escritura.
- Botón "Nuevo conector" abre un formulario: nombre, proveedor (select: Anthropic / OpenAI / OpenAI-compatible
  / Google), modelo (texto libre, ej. `claude-sonnet-4-6`, `gpt-4.1`), URL base (opcional, solo para
  OpenAI-compatible/self-hosted), y la API key (input tipo password, nunca en texto plano en pantalla,
  se envía una sola vez al backend).
- Acción "Desactivar" por fila (no hay borrado físico de conectores, para preservar qué conector generó qué
  preguntas en `generation_jobs`).

### 3. `/admin/generate` — Generación de preguntas bajo demanda
Formulario con estos campos (todos van al body de `POST admin_generation_jobs`):
- **Conector LLM a usar**: select poblado desde `admin_connectors` (solo los `is_active = true`).
- **Dominio y tarea ECO**: dos selects encadenados — elegir dominio (People/Process/Business Environment)
  filtra las tareas mostradas en el segundo select. Permite selección múltiple de tareas (para generar en
  lote contra varias tareas a la vez; el backend reparte el conteo entre ellas).
- **Enfoque**: select con "Mezcla automática (predictive/agile/hybrid)" o uno específico.
- **Formato**: select (mc_single, mc_multi, matching, enhanced_matching, graphic_based, hotspot, pulldown).
  Deja claro en la UI que por ahora el pipeline solo genera bien `mc_single`/`mc_multi`; el resto de formatos
  aceptan el parámetro pero pueden requerir revisión manual más exhaustiva.
- **Dificultad**: rango de 2 sliders o inputs (mínimo/máximo, escala 1-5).
- **Nº de preguntas a generar**: input numérico (1-200, valida en frontend igual que el backend).
- **Temas transversales** (opcional, multi-select o chips libres): ai, sustainability, value_delivery.
- Botón "Generar" llama a `POST admin_generation_jobs` y muestra un estado de carga — la función puede tardar
  bastante si se piden muchas preguntas (ejecución síncrona). Al completarse, muestra un resumen: cuántas se
  generaron, cuántas fallaron validación, y enlaza a la cola de revisión (`/admin/review`) filtrada por las
  recién creadas.
- Debajo del formulario, tabla de "Jobs recientes" (`GET admin_generation_jobs`): fecha, conector usado,
  tareas objetivo, solicitadas/generadas/fallidas, estado, con el detalle de error expandible si `status='failed'`.

### 4. `/admin/review` — Cola de revisión y gestión del banco
- Tabla de preguntas filtrable por `status`, dominio, tarea, approach. Por defecto muestra `status = 'draft'`
  y `'in_review'` (lo pendiente de revisar).
- Cada fila expandible muestra: enunciado completo, opciones, respuesta correcta marcada, explicación, tarea
  ECO asociada, dificultad. Si es `case_child`, muestra también el escenario del cluster padre.
- Acciones por fila (o en lote, con selección múltiple): "Aprobar y publicar" (→ `published` vía
  `PATCH admin_questions`), "Rechazar" (→ vuelve a `draft` o pasa a `retired` si ya no se quiere reciclar),
  "Retirar" (→ `retired`, saca del pool sin borrar), "Eliminar" (→ `DELETE admin_questions`; si el backend
  responde `retired: true` en vez de `deleted: true`, muestra el motivo — significa que ya se usó en
  exámenes reales y no se puede borrar sin romper el histórico).
- Filtro adicional por `times_used_in_exams` y `success_rate_pct` (cruzando con `v_question_stats`) para
  encontrar rápidamente candidatas a retirar por sobreuso o por estar mal calibradas.

## Estilo visual

- Interfaz densa en datos, tipo panel de administración interno (piensa en Retool, Metabase o el propio
  dashboard de Supabase) — no necesita la pulcritud de marketing de la app pública. Prioriza tablas claras,
  filtros visibles, y feedback inmediato de éxito/error en cada acción.
- Reutiliza la paleta de marca de la app pública para mantener coherencia, pero con una barra lateral de
  navegación fija entre Dashboard / Conectores / Generar / Revisión — no reutilices el layout de navegación
  del candidato.

## Restricciones técnicas

- Nunca almacenes la API key de un conector en el estado del cliente más tiempo del necesario para el envío
  del formulario; límpiala del estado inmediatamente después de la llamada a `admin_connectors`.
- Aísla las llamadas a estas Edge Functions en `services/adminService.ts`, separado del `services/examService.ts`
  de la app pública.
- Todas las tablas con volumen (banco de preguntas, jobs) necesitan paginación — no cargues todo de golpe.
