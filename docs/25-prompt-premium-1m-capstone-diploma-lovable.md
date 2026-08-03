# Prompt para Lovable — Plan Premium 1 mes + Diploma de Programa Completo

> Pega esto en el chat de Lovable. Backend ya desplegado (nuevo plan `premium_1m` y
> segundo tipo de diploma `programa_completo`).

## 1. Plan "Premium 1 mes" en precios y checkout

Nuevo plan en la tabla `plans`: código `premium_1m`, 24,90€ (precio sugerido,
pendiente de confirmación del PO — si cambia, solo hay que actualizar `price_cents`
en la tabla, no hace falta tocar código), mismas funciones que Premium 6 meses
(practicum completo, analítica avanzada, motor adaptativo), duración 1 mes.

- Añádelo en la sección de precios de la home y en `/checkout`, como opción junto a
  Básica y Premium — enmárcalo como *"Para quien está a pocos días del examen y
  quiere la experiencia completa ya"* o similar.
- Mismo flujo de Stripe que los otros planes de pago (`plan_code: "premium_1m"` en el
  metadata del checkout).

## 2. Diploma de "Programa Completo" (capstone)

`finish_exam` ahora puede devolver, además de `diploma` (el de simulacro completo que
ya mostráis), un segundo campo `capstone_diploma: { id, issued_at, disclaimer } | null`
— se emite la primera vez que un usuario completa **todas** las lecciones del temario
(unit_quiz aprobado en cada una) **y** tiene al menos un simulacro completo con buen
desempeño. Es un logro más raro y más grande que el diploma normal — máximo uno por
usuario, para siempre.

- En la pantalla de resultado, si `capstone_diploma` no es `null`, muestra un banner
  claramente más destacado que el del diploma normal (es un hito mayor: "completaste
  todo el temario"), con su propio texto: *"🏆 ¡Programa completo! Has aprobado todas
  las lecciones del temario y completado un simulacro completo con buen desempeño."*
  — con el mismo `disclaimer` visible (no es una nota de corte oficial de PMI).
- En la sección "Mis diplomas" (perfil/historial), distingue visualmente los dos tipos
  — por ejemplo con un icono o etiqueta distinta ("Simulacro" vs "Programa completo").
- Si quieres mostrar progreso hacia este diploma antes de conseguirlo (ej. "10 de 13
  lecciones completadas"), puedes calcularlo en el cliente comparando las lecciones
  con unit_quiz aprobado del usuario contra el total de lecciones con tareas — no hay
  endpoint dedicado para esto todavía, pero es una mejora opcional, no bloqueante.
