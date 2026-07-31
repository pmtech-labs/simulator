# Prompt para Lovable — Auth de candidato + Checkout (sin Stripe aún) + Conectar el examen real

> Pega esto en el chat de Lovable del proyecto `pmtech-simulator`. Cubre lo que bloquea un MVP real:
> hoy no existe login/registro de candidato, el checkout es un stub, y toda la experiencia del
> candidato (`/dashboard`, `/examen`, `/historial`, `/progreso`, `/perfil`) sigue leyendo de
> `MOCK_USER`/`MOCK_QUESTIONS` en vez de Supabase — solo `/aprendizaje` está conectado de verdad.

## Contexto importante

Todavía **no tenemos cuenta de Stripe propia** (el conector de pagos actual pertenece a otro
proyecto). Por tanto: construye todo el flujo de auth, señalización de plan elegido y estructura de
checkout, pero dejando el punto exacto donde se llamaría a Stripe como un `TODO` claramente marcado
y con una pantalla de "pago próximamente" en su lugar — no inventes una integración de pago falsa
que parezca funcionar.

## 1. Registro y login de candidato (no existe ninguna ruta hoy)

- `/registro`: formulario email + contraseña (+ confirmación). Usa `supabase.auth.signUp()`. Tras
  registrarse, si venía de elegir un plan en `/#precios`, guarda el `plan_code` elegido en el estado
  de navegación o en query param (`/registro?plan=premium_6m`) para retomarlo después del registro.
- `/login`: email + contraseña con `supabase.auth.signInWithPassword()`, enlace a
  `/forgot-password` (ya existe).
- Protege las rutas de candidato (`/dashboard`, `/examen`, `/historial`, `/progreso`, `/perfil`,
  `/aprendizaje`) con un guard que redirija a `/login` si no hay sesión — sigue el mismo patrón que
  ya usa `/admin` (`checkIsAdmin` + redirect), pero aquí solo hace falta comprobar que hay usuario
  autenticado, no rol admin.
- Actualiza los enlaces "Iniciar sesión" de la home (`Header`, `Footer`) para que apunten a `/login`
  en vez de `/dashboard` directamente.

## 2. Flujo de "compra" preparado, sin Stripe todavía

- En `/precios` (o en la sección de pricing de la home), el botón "Elegir {plan}" debe:
  1. Si no hay sesión → llevar a `/registro?plan={code}`.
  2. Si hay sesión → llevar a una pantalla `/checkout?plan={code}` (nueva).
- `/checkout`: muestra el resumen del plan elegido (nombre, precio, duración, features) y un botón
  "Continuar al pago". Al pulsarlo, por ahora (sin Stripe real):
  - Muestra un estado "Este paso estará disponible en cuanto activemos el cobro online. Mientras
    tanto, contacta con nosotros para activar tu licencia manualmente" con un mailto: o enlace de
    contacto — NO simules un pago exitoso ni actives una licencia falsa.
  - Dejar comentado/marcado en el código exactamente dónde iría la llamada real:
    `// TODO: Stripe — createCheckoutSession() debe invocar una Edge Function que cree una sesión
    real de Stripe Checkout con client_reference_id=user.id y metadata.plan_code, y redirigir a
    session.url. Requiere STRIPE_SECRET_KEY configurada (pendiente: cuenta de Stripe propia).`
- Esto dejará el frontend listo para activar el pago real con un cambio mínimo el día que haya
  cuenta de Stripe, sin necesidad de rehacer la UI.

## 3. Conectar el examen y el resto de la experiencia del candidato al backend real

Esto es lo más importante y lo que más faltaba. Reescribe `examService.ts` para que llame de verdad
a las Edge Functions ya desplegadas, siguiendo el mismo patrón que `adminService.ts`
(`supabase.functions.invoke`):

- `startExam(params)` → invoca `start_exam` con `{ mode, task_ids, question_count, unit_id }` según
  corresponda. Devuelve `exam_id`, `items`, `sections` (en `full_sim`), `time_limit_seconds`.
- `submitAnswer(examId, questionId, answer, timeSpentSeconds)` → invoca `submit_answer`. En modos
  formativos la respuesta trae `is_correct`, `correct_answer`, `explanation`, `error_type` — úsalos
  para el feedback inmediato. En `full_sim` la respuesta es solo `{ saved: true }`, no muestres nada.
- `finishExam(examId)` → invoca `finish_exam`. Usa `score_pct`, `score_by_domain`,
  `score_by_approach`, `new_items_count`, `repeated_items_count`, `disclaimer` e
  `interpretation_note` reales en la pantalla de resultado (ya están soportados en el diseño de
  `examen.tsx`, solo hay que dejar de usar `MOCK_FINISH_SUMMARY`).
- `getExamHistory()` → sustituir por un `select` directo sobre `exams` (RLS ya filtra por usuario).
- `getCurrentUser()` → sustituir por `supabase.auth.getUser()` + `select` sobre `licenses` (con join
  a `plans`) y `user_task_mastery` para construir el objeto de usuario real (nombre desde
  `user_metadata`, plan activo, mastery por dominio).
- Aplica el mismo cambio en `progreso.tsx` (que hoy usa `MOCK_TASK_MASTERY`/`MOCK_ERROR_TYPE_STATS`):
  lee `user_task_mastery` y `user_error_type_stats` directamente vía RLS.

## 4. Qué falla si un usuario intenta un simulacro completo hoy

El banco de preguntas real solo tiene ~32 ítems (cobertura mínima de 1 por tarea ECO, suficiente
para no bloquear `start_exam`, pero muy por debajo del volumen real). Un `full_sim` técnicamente
podrá generarse, pero con muy poca variedad — no ocultes esto: si quieres, añade una nota interna
(solo visible en un entorno de test/staging, no en producción) indicando que el banco está en fase
de construcción.
