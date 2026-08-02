# Prompt para Lovable — Dejar claro que las "lecciones" son temario propio, no de PMI

> Pega esto en el chat de Lovable. Ajusta `/aprendizaje` y `/practica`.

## Por qué

El texto actual ("Ruta de aprendizaje PMP · Temario por lecciones", "Recorre el temario
del programa PMP lección a lección...") se puede leer como si las 14 lecciones fueran
un concepto oficial de PMI. No lo son — es un temario propio nuestro, que sí está
mapeado a las 26 tareas reales del ECO 2026, pero la agrupación en 14 unidades es
nuestra, no de PMI. Alguien que venga de estudiar por libros organizados en las 10 áreas
de conocimiento clásicas de PMBOK (ya obsoletas, PMBOK 7/8 no las usa) podría confundirse
y pensar que buscamos ahí ese modelo.

## 1. `src/routes/aprendizaje.tsx` — cambios de texto

- Línea 32 (`head.title`): cambiar `"Ruta de aprendizaje PMP · Temario por lecciones"` →
  `"Ruta de aprendizaje PMTech · Temario propio mapeado al ECO 2026"`.
- Línea 36 (meta description): cambiar a algo como *"Nuestro temario propio,
  organizado en 14 lecciones mapeadas a las 26 tareas del ECO 2026, con tu dominio por
  unidad y práctica dirigida por lección o simulacro acumulativo."*
- Línea 288-289 (título/subtítulo de la página, el que ve el usuario): cambiar
  `title="Ruta de aprendizaje"` / `subtitle="El temario completo, lección a lección, con
  tu progreso real"` por:
  - `title="Ruta de aprendizaje PMTech"`
  - `subtitle="Nuestro temario propio, organizado para que practiques con progresión — cada lección está mapeada a tareas reales del ECO 2026"`

## 2. Añadir una nota explicativa visible (nueva, no existe hoy)

Justo debajo del título/subtítulo de `/aprendizaje`, antes de listar las lecciones,
añade un bloque corto y visible (no un tooltip escondido — esto tiene que verse sin
que el usuario tenga que buscarlo):

> **Nota:** las "lecciones" son nuestro propio temario de estudio, pensado para que
> practiques con progresión — no son un concepto oficial de PMI. Lo que sí es oficial
> son las **26 tareas del ECO 2026** (agrupadas en 3 dominios: Personas, Proceso,
> Entorno de Negocio), y cada lección está mapeada a una o varias de ellas. Si estudiaste
> con material antiguo organizado por "áreas de conocimiento" (Alcance, Cronograma,
> Coste...), ese modelo ya no se usa desde PMBOK 7 — aquí no lo vas a encontrar porque
> no es la estructura vigente del examen.

Usa un estilo visual discreto pero legible (icono de información + fondo suave), similar
al que ya usáis para el disclaimer de resultado del examen — no un banner de alerta,
es información de contexto, no una advertencia.

## 3. `src/routes/practica.tsx` — mismo criterio

- Línea 260-266: donde dice `"Lección a practicar"` / `"Selecciona una lección…"`, añade
  un texto de ayuda pequeño debajo del selector: *"Nuestro temario propio — mapeado a
  las tareas ECO 2026, no un concepto oficial de PMI."* (una sola línea, discreta, no
  hace falta repetir la explicación completa que ya está en `/aprendizaje`).

## 4. No toca (dejar exactamente igual)

- Todo lo que ya dice "tarea ECO", "dominio ECO", "ECO 2026" — eso sí es terminología
  oficial y está bien tal cual.
- El nombre interno de la ruta (`/aprendizaje`) y de los componentes — solo cambia el
  texto visible al usuario, no hace falta renombrar archivos ni rutas.
