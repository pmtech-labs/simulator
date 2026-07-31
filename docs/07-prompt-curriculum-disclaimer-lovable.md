# Añadido al prompt de Lovable — Currículo de lecciones y disclaimer de resultado

> Pega esto en el chat de Lovable del mismo proyecto. Afecta a `/admin` (gestión de unidades) y a la app
> pública (nuevos modos de práctica + disclaimer obligatorio en resultado).

## 1. Panel admin — gestión del currículo (`/admin/curriculum`)

Nueva sección para gestionar las unidades/lecciones del programa formativo propio (distinto de la
taxonomía ECO — esto es tu temario, no el de PMI). Tablas ya en Supabase: `course_units` (id, title,
description, sequence, status: draft|published) y `course_unit_tasks` (mapeo muchos-a-muchos con
`eco_tasks`).

- Listado de unidades ordenado por `sequence`, con su estado (draft/published) y cuántas tareas ECO
  tiene mapeadas.
- Formulario de alta/edición: título, descripción, número de secuencia, y un multi-select de tareas ECO
  (agrupado por dominio People/Process/Business Environment para que sea manejable con 26 opciones).
- Botón publicar/despublicar (cambia `status`). Una unidad en `draft` no es seleccionable por los
  candidatos en ningún modo de práctica — la RLS de Supabase ya lo garantiza en el backend, pero el panel
  debe dejarlo visualmente claro.
- Advertencia si se intenta publicar una unidad sin ninguna tarea ECO mapeada (el modo de práctica
  fallaría con error 409 del backend).

## 2. App pública — nuevos modos de práctica ligados al currículo

`start_exam` ahora acepta dos modos nuevos, además de los existentes (`full_sim`, `domain_drill`,
`case_only`, `custom`):

- **`unit_quiz`**: práctica de una sola lección/unidad. Requiere `unit_id` en el body. Solo incluye
  preguntas de las tareas ECO mapeadas a esa unidad.
- **`cumulative`**: "simulador acumulativo" — incluye todas las tareas ECO de todas las unidades
  publicadas con `sequence` menor o igual a la unidad elegida. Es decir, si el alumno va por la lección 5,
  el acumulativo cubre el contenido de las lecciones 1 a 5, no solo la 5. Requiere `unit_id` (la unidad
  "hasta la cual" se acumula).

En la pantalla de configuración de examen (la que ya tenías prevista), añade estas dos opciones al
selector de modo, con un sub-selector de unidad/lección (poblado desde `course_units` donde
`status = 'published'`, ordenado por `sequence`). Etiqueta claro para el candidato:
- "Practicar esta lección" → `unit_quiz`
- "Simulacro acumulativo (todo lo visto hasta aquí)" → `cumulative`

Si `course_units` está vacío (el temario aún no está cargado), oculta estas dos opciones del selector en
vez de mostrarlas rotas — comprueba con una query simple si hay alguna unidad `published` antes de
renderizarlas.

## 3. Disclaimer obligatorio en la pantalla de resultado

`finish_exam` ahora devuelve un campo `disclaimer` (string fijo, generado por el backend, no lo redactes
tú en el frontend) junto con el resto del resultado. Muéstralo siempre, de forma visible pero no
alarmante, justo debajo del score global — un cuadro de texto discreto (icono de información, no de
advertencia/error). No lo omitas ni lo sustituyas por texto propio: es la disclaimer legal/de expectativas
del producto y debe ser exactamente el texto que llega en la respuesta, no una paráfrasis.

También muestra `interpretation_note` cuando no sea null (ya estaba previsto en el prompt anterior de
secciones/errores) — son dos avisos distintos y pueden aparecer juntos: uno sobre qué puede prometer el
simulador en general (`disclaimer`, siempre presente), y otro sobre si el resultado concreto puede estar
inflado por preguntas repetidas (`interpretation_note`, solo a veces).
