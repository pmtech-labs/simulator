# Añadido al prompt de Lovable — Renderizar hotspot, graphic_based y pulldown

> Pega esto en el chat de Lovable. Cierra el hueco detectado al comparar contra el roadmap de la Fase 1:
> el banco de prueba debía incluir al menos una pregunta con gráfico/artefacto y una interactiva, y hoy
> `matching` ya se renderiza pero `hotspot`, `graphic_based` y `pulldown` no llegan a la pantalla del
> candidato (solo existen como opción en el formulario de generación admin).

## 1. `pulldown` — el más sencillo, sin cambios de esquema

Es exactamente igual que `mc_single` (mismas `options`/`correct_answer`), solo cambia la presentación:
en vez de una lista de radio buttons, renderiza un `<select>` (o el componente de `Select` que ya usáis
en el resto de la app) con las opciones como items del desplegable. La lógica de corrección y el payload
que ya envía `submit_answer` no cambian nada.

## 2. `graphic_based` — reutiliza el componente `EarnedValueChart` que ya existe

Ya tenéis `src/components/exam/EarnedValueChart.tsx`, hoy usado solo dentro de `cluster.evChart` para
clusters de caso. Para preguntas standalone de formato `graphic_based`, el `practicum_payload` de la
pregunta trae esta forma:

```json
{
  "chart_type": "earned_value",
  "evChart": { "labels": ["Mes 1", "Mes 2", "..."], "pv": [10, 25, ...], "ev": [8, 20, ...], "ac": [12, 28, ...] }
}
```

En la pantalla de examen, cuando `q.format === "graphic_based"` y `q.practicum_payload?.chart_type ===
"earned_value"`, renderiza `<EarnedValueChart chart={q.practicum_payload.evChart} />` **encima** del
enunciado, igual que ya hacéis con `cluster.evChart` — es literalmente el mismo componente, solo cambia
de dónde sale el dato (de `practicum_payload` en vez de `cluster`). Dejad `chart_type` como campo abierto
para poder añadir otros tipos de gráfico en el futuro (`chart_type !== "earned_value"` → por ahora no
renderiza nada, para no romper si se genera otro tipo).

## 3. `hotspot` — diagrama SVG inline con zonas clicables (sin imágenes externas)

Para evitar depender de alojar imágenes, el `practicum_payload` de una pregunta `hotspot` trae el propio
SVG del diagrama como marcado inline, más las zonas clicables en coordenadas porcentuales:

```json
{
  "diagram_svg": "<svg viewBox='0 0 400 200'>...</svg>",
  "hotspots": [
    { "id": "a", "label": "Nodo A", "x_pct": 10, "y_pct": 15, "w_pct": 20, "h_pct": 25, "correct": false },
    { "id": "b", "label": "Nodo B", "x_pct": 45, "y_pct": 40, "w_pct": 20, "h_pct": 25, "correct": true }
  ]
}
```

Renderiza `diagram_svg` con `dangerouslySetInnerHTML` (o parseado de forma segura si preferís no usar
eso) dentro de un contenedor con `position: relative`, y superpón un `<div>` transparente y clicable por
cada hotspot, posicionado con `left/top/width/height` en `%` según `x_pct/y_pct/w_pct/h_pct`. Al hacer
clic, guarda el `id` del hotspot elegido como `user_answer` (mismo formato array que el resto de formatos,
ej. `["b"]`), y compara contra el/los hotspot(s) marcados `correct: true` — reutiliza la misma lógica de
corrección que ya tenéis, no hace falta lógica nueva en el backend (`submit_answer` ya compara por
conjunto de ids).

## Verificación

Tras este cambio, aseguraos de que las preguntas de estos 3 formatos (que ya llegaréis a tener publicadas
en el banco) aparecen correctamente en `/examen` tanto en modo simulacro completo como en modo práctica,
y que el resultado final las corrige y muestra explicación igual que el resto de formatos.

## Nota sobre `matching` en modo simulacro completo (full_sim)

`matching` ya se renderiza y ya hay una pregunta real publicada de este formato en el banco. Una cosa a
verificar: en `full_sim` no se muestra feedback hasta el final (por diseño), así que la corrección de
`matching` en ese modo debe hacerla el backend (`submit_answer`), no solo el cálculo cliente que ya usáis
para el feedback inmediato en modos formativos. Para que `submit_answer` pueda comparar correctamente,
enviad `user_answer` como un array de strings `"idIzquierda:idDerecha"` (ej. `["r1:d2","r2:d1",...]`),
igual que está guardado `correct_answer` en la pregunta de ejemplo ya publicada — así la comparación por
conjunto que ya usa `submit_answer` funciona sin cambios adicionales en el backend.
