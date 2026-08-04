# Prompt para Lovable — R2-R7: navegación, pantalla de revisión, reloj global, descansos

> El backend ya está listo y verificado con un examen real de principio a fin.
> Esto es un cambio grande de frontend — te lo dejo dividido en bloques claros.

## Contexto — qué cambia respecto a lo que hay hoy

Hoy el examen usa **3 relojes independientes** (uno por sección, cada uno con su
`time_limit_seconds` proporcional al número de preguntas). El PO ha confirmado que
es **UN ÚNICO reloj de 240 minutos** para las 180 preguntas, compartido entre los 3
bloques, con descansos que lo pausan. Esto requiere tocar la lógica del temporizador,
no solo añadir pantallas nuevas.

## 1. Backend disponible (ya desplegado y probado)

**Nueva Edge Function `exam_section_control`** — 3 acciones, todas devuelven el
estado autoritativo del reloj:

```ts
// Cerrar el bloque actual (botón "Finalizar sección" en la pantalla de revisión)
POST exam_section_control
{ exam_id, action: "finalize_section", section_number: 1 }
// -> { section_closed: 1, next_section: 2, exam_complete: false, remaining_seconds: 14398, paused: false }
// Si era el último bloque: next_section: null, exam_complete: true (entonces llama a finish_exam)

// Empezar un descanso (máximo 2 por examen, tras bloque 1 y tras bloque 2)
POST exam_section_control
{ exam_id, action: "start_break" }
// -> { paused: true, remaining_seconds: 14397, break_allowance_seconds: 600 }

// Reanudar tras el descanso
POST exam_section_control
{ exam_id, action: "resume_break" }
// -> { paused: false, break_duration_seconds: 15, credited_seconds: 15, overage_seconds: 0, remaining_seconds: 14396 }
```

**`start_exam`**: sigue devolviendo `time_limit_seconds` (240*60=14400) a nivel de
examen — este es el ÚNICO valor de tiempo real. El campo `sections[].seconds` que
devolvía antes (presupuesto por bloque) ya no representa nada real — ignóralo o
trátalo como puramente informativo si lo sigues mostrando.

**`submit_answer`**: ahora devuelve error 409 "Se agotó el tiempo del examen. Debe
finalizarse." si el reloj global llegó a 00:00. Cuando lo recibas, llama a
`finish_exam` inmediatamente (R6: "el examen finaliza de forma inmediata").

## 2. Cálculo del reloj en el frontend (para el contador visual entre llamadas)

Entre llamadas al backend, el frontend debe llevar su propia cuenta atrás local
(no se puede estar llamando al servidor cada segundo). Fórmula exacta para
replicar lo que hace el backend:

```ts
function computeRemainingSeconds(exam: {
  time_limit_seconds: number;
  started_at: string;
  paused_at: string | null;
  break_extension_seconds: number;
}): number {
  const startedMs = new Date(exam.started_at).getTime();
  const extensionMs = exam.break_extension_seconds * 1000;
  const limitMs = exam.time_limit_seconds * 1000;
  const nowMs = exam.paused_at ? new Date(exam.paused_at).getTime() : Date.now();
  const elapsedMs = nowMs - startedMs;
  return Math.max(0, Math.round((limitMs + extensionMs - elapsedMs) / 1000));
}
```

Mientras `paused_at` no sea null, el resultado se queda fijo (congelado) sin
necesidad de parar ningún `setInterval` — la fórmula ya lo hace sola.

## 3. R6 — Pantalla de Revisión obligatoria al final de cada bloque

Al llegar a la pregunta 60, 120 o 180 (última de cada bloque) e intentar avanzar,
en vez de navegar a la siguiente pregunta se muestra una **Pantalla de Revisión**:

- Listado de las 60 preguntas del bloque, categorizadas visualmente en 3 grupos:
  **Respondida**, **Sin responder**, **Marcada** (una pregunta puede estar
  respondida y marcada a la vez — mostrar ambos estados si aplica).
- Cada ítem del listado es clicable: lleva de vuelta a esa pregunta concreta para
  poder modificar la respuesta (dentro del mismo bloque, todavía no cerrado).
- Un botón **"Finalizar sección"**, claramente distinguido (ej. con confirmación
  tipo modal: "¿Seguro que quieres finalizar? No podrás volver a esta sección").
- Al confirmar: llama a `exam_section_control` con `action: "finalize_section"` y
  el `section_number` actual.
  - Si `exam_complete: true` → llama a `finish_exam` y navega a la pantalla de
    resultado.
  - Si no → navega a la primera pregunta del `next_section` devuelto, y actualiza
    el estado del examen en memoria (bloques anteriores ahora bloqueados, ver punto 4).

## 4. R6 — Bloqueo de navegación entre bloques

Una vez finalizada una sección (`status: "completed"` en la respuesta o en el
estado del examen), **no debe poder volver a acceder a sus preguntas** desde
ningún sitio: ni desde el navegador lateral (`QuestionNavigator`), ni con el botón
"atrás". El navegador lateral ya tiene lógica de bloqueo por sección (`locked`,
`activeSection`) — hay que asegurarse de que se marca como bloqueada
PERMANENTEMENTE la sección que se acaba de cerrar (no solo las secciones
"futuras" como hace hoy).

## 5. R4 — Acciones de navegación que faltan

Además de avanzar/retroceder/ir a una pregunta concreta (ya existen), añadir:

- **Botón "Ir a marcadas"**: filtra la vista del navegador lateral para mostrar
  solo las preguntas marcadas con bandera del bloque actual — al pulsar sobre una,
  navega a ella. Puede ser un toggle de filtro sobre el mismo `QuestionNavigator`
  en vez de una pantalla nueva.
- **Botón "Volver a la primera sin responder"**: navega directamente a la primera
  pregunta del bloque actual que no tenga respuesta guardada. Si todas están
  respondidas, deshabilita el botón o muestra un aviso.

Ambos actúan solo dentro del bloque activo (no cruzan a bloques ya cerrados).

## 6. R7 — Descansos entre bloques

Justo después de cerrar el bloque 1 o el bloque 2 (tras `finalize_section` con
`next_section` no nulo y `section_closed` 1 o 2), antes de mostrar la primera
pregunta del siguiente bloque, ofrece un botón opcional **"Tomar descanso (10
min)"**. Si el candidato lo ignora, pasa directo a la primera pregunta del
siguiente bloque como ahora.

Si pulsa el botón:
- Llama a `exam_section_control` con `action: "start_break"`.
- Muestra una pantalla de descanso con **un segundo reloj independiente**, contando
  hacia abajo desde 10:00 — este reloj es puramente visual/informativo en el
  frontend (cuenta atrás simple), no afecta al reloj principal.
- Un botón **"Reanudar examen"**, disponible en cualquier momento (el candidato no
  tiene que esperar a que el reloj de 10 min llegue a 0).
- Al pulsar reanudar: llama a `action: "resume_break"`, recibe el
  `remaining_seconds` actualizado del reloj principal, y lo usa para
  reinicializar la cuenta atrás principal antes de mostrar la primera pregunta del
  bloque siguiente.
- Si el candidato ya usó los 2 descansos disponibles, `start_break` devuelve un
  error 409 ("Ya se han usado los 2 descansos disponibles") — en ese caso no
  ofrezcas el botón (puedes comprobar `breaks_used` en el estado del examen antes
  de mostrarlo, aunque el backend lo rechazará igualmente como salvaguarda).

## 7. R6 — Corte automático a los 00:00

Cuando el reloj principal (calculado con la fórmula del punto 2) llegue a 0,
llama a `finish_exam` inmediatamente y navega a la pantalla de resultado, sin
esperar a que el candidato interactúe. Si el candidato intenta responder justo en
ese instante y `submit_answer` devuelve el error 409 de tiempo agotado, trata esa
respuesta igual que si el reloj hubiera llegado a 0 localmente.
