# Añadido al prompt de Lovable — Secciones, tipos de error e interpretación del resultado

> Pega esto en el chat de Lovable del mismo proyecto (ajusta lo ya construido en `02-prompt-frontend-lovable.md`).
> Basado en ajustes reales del backend: el examen completo ahora se sirve como 3 secciones cronometradas
> independientes, con feedback condicionado al modo, y un diagnóstico de tipo de error por respuesta fallada.

## 1. Pantalla de examen — 3 secciones, no un timer único

La respuesta de `start_exam` en modo `full_sim` ahora incluye un array `sections` (3 elementos: `count` y
`seconds` de cada una) y cada ítem trae `section_number`. Ajusta la pantalla de examen:

- Muestra el cronómetro de la **sección actual**, no un timer global de 240 minutos.
- Al completar todos los ítems de una sección, muestra la pantalla de **descanso (10 min, opcional/omitible)**
  antes de pasar a la siguiente sección — igual que el examen real.
- El navegador de preguntas (grid numerado) debe indicar visualmente a qué sección pertenece cada pregunta,
  y no permitir saltar a preguntas de una sección ya cerrada.
- Los clusters de caso nunca quedan partidos entre dos secciones (el backend ya lo garantiza) — no hace falta
  lógica adicional en el frontend para esto, solo respetar el orden que llega en `items`.

## 2. Feedback condicionado al modo (formativo vs. examen completo)

`submit_answer` ahora responde distinto según el modo del examen:

- **Modos formativos** (`domain_drill`, `case_only`, `custom`): la respuesta incluye `is_correct`,
  `correct_answer`, `explanation` y `error_type` (si falló). Muestra el feedback inmediatamente tras
  responder, con la explicación completa.
- **`full_sim`**: la respuesta es solo `{ saved: true }` — no muestres ningún feedback, ni siquiera un
  check/cruz visual, hasta que el usuario termine todo el examen. Esto es intencional: replica la presión
  real del examen oficial.

## 3. Tipos de error en el feedback formativo

Cuando `error_type` viene en la respuesta de `submit_answer` (modos formativos), tradúcelo a un texto claro
para el usuario en vez de mostrar el código técnico:

| error_type | Texto para el usuario |
|---|---|
| `sequence` | "Era una acción válida, pero no la que correspondía hacer primero" |
| `role` | "Esa decisión corresponde a otra persona, no al director de proyecto en este contexto" |
| `approach` | "Aplicaste lógica de un enfoque (predictivo/ágil) que no corresponde a este contexto" |
| `analysis` | "Actuaste sin considerar toda la información del escenario" |
| `knowledge` | "El concepto o principio aplicado no es correcto" |
| `interpretation` | "Se malinterpretó la situación descrita" |
| `reading` | "Se pasó por alto un dato decisivo del enunciado" |
| `time` | "La urgencia o el tiempo no se gestionaron adecuadamente" |

## 4. Pantalla de resultado — nota de interpretación

`finish_exam` ahora devuelve `new_items_count`, `repeated_items_count`, y opcionalmente
`interpretation_note` (un string) cuando más del 30% de las preguntas ya se habían respondido antes.

- Muestra siempre "X de Y preguntas eran nuevas para ti" en el resumen del resultado.
- Si `interpretation_note` no es null, muéstralo como un aviso visible (no un error, un matiz informativo)
  cerca del score global — el objetivo es que el usuario no sobreestime su preparación real por haber
  visto parte de las preguntas antes.

## 5. Analítica — patrón de errores por tipo (solo Premium)

Añade a `/dashboard` (o a la sección de analítica ya prevista para Premium) un desglose de
`user_error_type_stats` (tabla ya en Supabase, consúmela vía select directo con RLS de usuario): un gráfico
de barras simple con los 8 tipos de error y cuántas veces ha caído el usuario en cada uno. Esto es más
accionable que solo el % de aciertos — le dice al usuario si su problema es de conocimiento, de secuencia
de acciones, de atribución de rol, etc.
