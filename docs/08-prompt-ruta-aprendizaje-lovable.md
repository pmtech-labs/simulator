# Añadido al prompt de Lovable — Ruta de aprendizaje (temario) para el candidato

> Pega esto en el chat de Lovable del mismo proyecto. Complementa `07-prompt-curriculum-disclaimer-lovable.md`
> (que cubría el panel admin y los modos de examen `unit_quiz`/`cumulative`) con la pantalla pública que
> consume ese currículo.

## `/aprendizaje` (o dentro del dashboard) — Ruta de aprendizaje del candidato

Nueva pantalla que muestra el temario del programa como una ruta secuencial, no solo un selector de modo
de examen perdido en la configuración.

- Consulta `course_units` (solo `status = 'published'`, ordenado por `sequence`) y, para cada unidad,
  cuenta cuántas tareas ECO tiene mapeadas vía `course_unit_tasks` (join a `eco_tasks`/`eco_domains` para
  mostrar a qué dominio pertenece cada unidad — útil para que el candidato entienda de un vistazo si está
  reforzando People, Process o Business Environment).
- Presenta las 14 unidades como una lista/timeline vertical numerada (1 a 14), cada una con:
  - Título y descripción breve.
  - Badge de dominio(s) que cubre (puede tocar más de uno si la unidad mapea tareas de dominios distintos
    — en el temario actual no ocurre, pero el diseño debe soportarlo).
  - `mastery_pct` agregado del usuario para las tareas de esa unidad (promedio simple sobre
    `user_task_mastery` filtrado por los `task_id` de `course_unit_tasks` de esa unidad) — así el
    candidato ve su progreso por lección, no solo por dominio ECO general.
  - Dos botones: **"Practicar esta lección"** (lanza `start_exam` modo `unit_quiz` con ese `unit_id`) y
    **"Simulacro acumulativo hasta aquí"** (modo `cumulative`, mismo `unit_id`) — este segundo botón solo
    se activa a partir de la unidad 2 (con solo la unidad 1 acumulada no hay tareas ECO que evaluar, ya
    que es la unidad introductoria sin mapeo).
- La unidad 1 ("Fundamentos y panorama del examen PMP") no tiene tareas ECO asociadas — no muestres los
  dos botones de práctica para ella, solo su descripción informativa. Trátala como contenido de
  orientación, no de evaluación.
- Ordena visualmente de arriba a abajo según `sequence`; no reordenes por dominio ni alfabéticamente.

## Diseño

Reutiliza el mismo lenguaje visual del dashboard (barras de progreso ya usadas para `mastery_pct` por
dominio). Esta vista es el "mapa del temario" — debe transmitir progreción clara, no ser una tabla plana;
un timeline vertical con la unidad actual (primera con progreso incompleto) destacada visualmente ayuda a
que el candidato sepa "por dónde voy" sin tener que calcularlo él mismo.
