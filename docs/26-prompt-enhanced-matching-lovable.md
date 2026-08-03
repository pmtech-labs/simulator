# Prompt para Lovable — Renderizar `enhanced_matching` (emparejamiento con gráficos)

> Pega esto en el chat de Lovable. Ya hay 1 pregunta real publicada de este formato
> para probarlo.

## Qué es

Aclarado por el PO: "Emparejamiento Mejorado" (definido en el ECO 2026) es igual que
el matching normal, pero **al menos un lado del emparejamiento son gráficos, no solo
texto**. Una solución puede admitir más de un emparejamiento válido, pero cada
emparejamiento individual sigue siendo uno a uno.

## Payload real (ya en base de datos)

Mismo esquema que `matching` (`left`/`right`/`correctPairs`), pero cada item de
`left` incluye un campo `svg` con el gráfico:

```json
{
  "left": [
    { "id": "func", "label": "Estructura A", "svg": "<svg viewBox=\"0 0 160 100\">...</svg>" },
    { "id": "proy", "label": "Estructura B", "svg": "<svg viewBox=\"0 0 160 100\">...</svg>" }
  ],
  "right": [
    { "id": "d1", "label": "Organización funcional: ..." }
  ],
  "correctPairs": [["func", "d1"], ["proy", "d2"]]
}
```

## Implementación

Reutiliza `MatchingQuestion.tsx` casi tal cual — el único cambio es que, si un item de
`left` trae `svg`, se renderiza el gráfico en vez del texto plano:

```tsx
{payload.left.map((item) => (
  <div key={item.id} className="matching-left-card" draggable={!disabled}>
    {item.svg
      ? <div className="h-24 w-40" dangerouslySetInnerHTML={{ __html: item.svg }} />
      : <span>{item.label}</span>}
  </div>
))}
```

- El resto de la lógica (arrastrar, soltar, validar `correctPairs`, modo `disabled`
  para revisión) es exactamente igual que `matching` — no hay que reescribir nada más.
- En `admin/review`, aplica el mismo componente (con `disabled`) para poder revisar
  visualmente el gráfico, igual que hicisteis con `hotspot`/`matching` normal.
