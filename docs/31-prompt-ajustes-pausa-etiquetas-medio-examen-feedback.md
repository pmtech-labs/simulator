# Prompt para Lovable — Ajustes varios del PO (pausa, etiquetas, medio examen, feedback)

> Backend ya listo y verificado para todo lo que requiere cambios de datos. Esto es
> principalmente frontend.

## 1. Quitar el botón genérico de "Pausar / Reanudar"

En `src/routes/examen.tsx` hay un botón "Pausar"/"Reanudar" (estado `paused`, líneas
~250, ~320-328, ~834-835, ~984) que congela la cuenta atrás local en CUALQUIER tipo
de examen. El PO ha confirmado que en el examen PMP real no se puede pausar — hay
que quitarlo por completo:

- Elimina el estado `paused` y el botón asociado.
- Elimina el `if (paused) return;` dentro del efecto del temporizador.
- Elimina el bloque condicional `{paused && (...)}` que muestra el overlay de pausa.

**Importante**: esto NO afecta al descanso oficial de R7 (`start_break`/`resume_break`
de `exam_section_control`, del prompt anterior) — ese es un mecanismo distinto,
limitado a 2 veces y solo entre bloques del examen completo. Lo que se quita aquí es
el botón genérico que permite pausar en cualquier momento y en cualquier tipo de
examen (completo o parcial).

## 2. Quitar las etiquetas visibles durante el examen

Antes pedimos mostrar unos badges con dominio/enfoque/dificultad/área de
enfoque/dominio de desempeño/formato durante el examen (captura de referencia:
`BE-5 · Híbrido · Media · Monitoreo y Control · Riesgos · Caso de estudio`). El PO ha
aclarado que estas etiquetas son **internas de administración** y no deben verse
durante el examen, en ningún modo (completo, parcial, medio examen).

Quita esa fila de badges por completo de `src/routes/examen.tsx` (la que muestra
`q.taskCode`, el enfoque, `difficultyLabel(q.difficulty)`, el formato, y los badges de
`processGroup`/`performanceDomain`/`focusTags` que añadimos después). El candidato no
debe ver ninguna clasificación de la pregunta, solo el enunciado y las opciones.

(Estas etiquetas siguen siendo útiles y deben seguir viéndose en el panel de
administración — cola de revisión, dashboard, etc. Este cambio es solo para la vista
del candidato durante el examen.)

## 3. Nuevo modo: Medio examen (90 preguntas / 2 horas)

Backend ya soporta `mode: "half_sim"` en `start_exam`, con las mismas garantías que
`full_sim` (mismos % de dominio/enfoque/área de enfoque/dominio de
desempeño/formato/temáticas, solo que escalados a 90 preguntas) pero SIN la
estructura de bloques/revisión/descansos de R5-R7 (eso es exclusivo del examen
completo de 180).

Añade una opción "Medio examen" junto a "Simulacro completo" (en el panel principal o
donde esté hoy el botón de simulacro completo), que llame a `start_exam` con
`{ mode: "half_sim" }`. El backend devuelve `time_limit_seconds: 7200` (2h) — usa el
mismo mecanismo de cronómetro que ya tienes para `full_sim`, simplemente con el modo y
el tiempo que vengan en la respuesta (no hace falta lógica nueva de cronómetro).

## 4. El cronómetro solo debe verse en simulacro completo y medio examen

Confirma que el componente de cronómetro (`ExamTimer` o equivalente) solo se
renderiza cuando `exam.time_limit_seconds` no es `null` — el backend ya solo lo
rellena para `full_sim` y `half_sim`, así que si el componente ya condiciona su
render por ese campo, no hace falta ningún cambio. Si en algún sitio se está
mostrando un cronómetro basado en otra condición (ej. por `mode !== 'custom'` u otra
lógica), cámbialo para que dependa exclusivamente de `time_limit_seconds != null`.

## 5. Feedback de usuarios

Nueva tabla `app_feedback` ya creada con RLS (el usuario autenticado puede insertar y
leer solo su propio feedback; no hace falta pasar `user_id`, se rellena solo desde la
sesión):

```ts
await supabase.from("app_feedback").insert({
  message: "texto del feedback",
  rating: 5, // opcional, 1-5
  page_context: "dashboard", // opcional, qué pantalla lo originó
});
```

Añade un punto de entrada sencillo en alguna pantalla de usuario (el perfil o el panel
principal son buenos sitios) — puede ser un botón "Enviar feedback" que abra un modal
simple con un textarea y, opcionalmente, una valoración de 1 a 5 estrellas. No hace
falta nada más elaborado: guardar el mensaje y confirmar con un toast de "Gracias por
tu feedback" es suficiente.

## 6. Numeración y orden de preguntas — ya corregido en el backend

El bug de numeración descolocada (capturas: "1, 8, 9, 10, 11..." en vez de
secuencial) ya está arreglado en `start_exam` — el array `items` que devuelve ahora
viene siempre en el orden real correcto (bloque 1 → bloque 2 → bloque 3, y dentro de
cada uno, secuencial). Si el frontend numera las preguntas por la posición del ítem
dentro del array `items` (o usando el nuevo campo `order_index` que cada ítem trae),
no hace falta ningún cambio adicional — simplemente ya no debería reproducirse el
problema. Si en algún sitio se estaba reordenando o agrupando `items` de alguna otra
forma antes de numerar, revisa que ya no haga falta esa lógica.
