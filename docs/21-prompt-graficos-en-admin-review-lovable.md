# Prompt para Lovable — Renderizar gráficos/diagramas/hotspots en `/admin/review`

> Pega esto en el chat de Lovable. Ajusta el detalle expandido de cada pregunta en
> `admin.review.tsx` (el bloque que hoy solo muestra `<p>{q.stem}</p>` en texto plano).

## El problema real

`admin.review.tsx` no tiene ninguna lógica para `practicum_payload`, `chart_type` ni
`diagram_svg`. Las preguntas con gráfico de valor ganado, diagrama de red (CPM/PDM),
hotspot o matching **están en la cola de revisión** (cuentan correctamente en el total),
pero al abrir el detalle el admin solo ve el enunciado en texto — no puede ver el
gráfico, el diagrama ni las zonas clicables que está revisando. Es imposible aprobar
con criterio algo que no se puede ver.

## Fix: reutilizar exactamente los mismos componentes que ya existen para `/examen`

No hay que construir nada nuevo — `examen.tsx` ya sabe renderizar los 4 formatos
(`matching`, `hotspot`, `graphic_based` con `earned_value` y con `network_diagram`,
`pulldown`). Solo hay que llamar a esa misma lógica de renderizado dentro del bloque de
detalle expandido de la cola de revisión, justo antes o junto al `<p>{q.stem}</p>`
(línea ~407 de `admin.review.tsx`):

```tsx
{q.format === "graphic_based" && q.practicum_payload?.chart_type === "earned_value" && (
  <EarnedValueChart chart={q.practicum_payload.evChart} />
)}
{q.format === "graphic_based" && q.practicum_payload?.chart_type === "network_diagram" && (
  <div
    className="w-full overflow-x-auto rounded-lg border border-border bg-card p-3"
    dangerouslySetInnerHTML={{ __html: q.practicum_payload.diagram_svg }}
  />
)}
{q.format === "hotspot" && q.practicum_payload?.diagram_svg && (
  <HotspotQuestion payload={q.practicum_payload} disabled correctAnswer={q.correct_answer} />
)}
{q.format === "matching" && q.practicum_payload && (
  <MatchingQuestion payload={q.practicum_payload} disabled />
)}
```

- Usad los componentes reales que ya existen (`EarnedValueChart`, `HotspotQuestion`,
  `MatchingQuestion` en `src/components/exam/`) — no los reescribáis.
- **Ya existe la prop `disabled`** en `HotspotQuestion` y `MatchingQuestion` (no hace
  falta crear una nueva) — al pasarla, desactiva la interacción y, en el caso de
  `HotspotQuestion`, revela la respuesta correcta (mirad la lógica de `reveal` que ya
  tiene el componente: se activa con `disabled` combinado con los hotspots marcados
  como correctos). Es exactamente el comportamiento que interesa en revisión: ver el
  material tal como lo vería el candidato, con la respuesta correcta ya señalada.
- Para `pulldown`, no hace falta ningún componente especial — ya se renderiza igual que
  `mc_single` en cuanto a mostrar `options`, así que no necesita cambios.

## Verificación

Después de este cambio, al abrir el detalle de las 10 preguntas con gráfico que ya
tenéis en el banco (1 valor ganado, 1 diagrama de red publicada + 8 diagramas de red en
borrador, 1 hotspot, 1 matching), el admin debe poder ver el elemento visual completo,
no solo el texto del enunciado.
