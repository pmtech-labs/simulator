# Prompt para Lovable — R4: botones "Ir a marcadas" y "Volver a la primera sin responder"

> Backend sin cambios. El PO ha confirmado el requisito R4 de navegación — ya
> tenemos avanzar/retroceder/ir a una pregunta concreta (clic en el mapa numerado).
> Faltan los 2 últimos: filtrar el mapa para ver solo las marcadas, y saltar
> directamente a la primera pregunta sin responder. Ambos deben operar **solo
> dentro del bloque/sección actual de 60 preguntas** (no sobre las 180 completas),
> igual que ya hacen "Anterior"/"Siguiente".

## Contexto (variables ya disponibles en `src/routes/examen.tsx`)

```ts
const firstIndexOfSection = questions.findIndex(...); // ya existe
const lastIndexOfSection = firstIndexOfSection + sectionQuestions.length - 1; // ya existe
const questions = session.questions; // array completo de las 180
const answers: Record<string, unknown>; // ya existe
const flagged: Record<string, boolean>; // ya existe
```

## 1. Botón "Volver a la primera sin responder"

Junto al botón "Anterior" (busca el `<div className="flex items-center gap-2">` que
ya contiene "Anterior" y "Siguiente"/"Cerrar sección"), añade:

```tsx
<button
  onClick={() => {
    const firstUnanswered = questions
      .slice(firstIndexOfSection, lastIndexOfSection + 1)
      .findIndex((q) => !answers[q.id]);
    if (firstUnanswered !== -1) setIndex(firstIndexOfSection + firstUnanswered);
  }}
  disabled={questions
    .slice(firstIndexOfSection, lastIndexOfSection + 1)
    .every((q) => answers[q.id])}
  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
  title="Ir a la primera pregunta sin responder de esta sección"
>
  Primera sin responder
</button>
```

Se deshabilita solo (con opacidad reducida) cuando ya no queda ninguna pregunta sin
responder en el bloque actual.

## 2. Botón "Ir a marcadas" (filtro del mapa de navegación)

Este necesita un pequeño cambio de estado en `examen.tsx` y pasarlo a
`QuestionNavigator`:

**En `examen.tsx`:**

```ts
const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
```

Añade el botón de toggle donde tenga sentido visualmente (por ejemplo, junto al
título del mapa de preguntas, o junto a `ReportIssueButton`):

```tsx
<button
  onClick={() => setShowOnlyFlagged((v) => !v)}
  className={cn(
    "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium",
    showOnlyFlagged ? "border-accent bg-accent/10 text-accent" : "border-border",
  )}
>
  <Flag className="h-4 w-4" /> {showOnlyFlagged ? "Ver todas" : "Ver solo marcadas"}
</button>
```

Pasa `showOnlyFlagged` a las dos instancias de `<QuestionNavigator ... />` (escritorio
y móvil) como prop nueva.

**En `src/components/exam/QuestionNavigator.tsx`:** añade el prop y, dentro de la
sección activa, atenúa (no ocultes del todo — el candidato debe poder seguir viendo
la numeración completa) los botones que no estén marcados cuando el filtro esté
activo:

```tsx
export function QuestionNavigator({
  questions,
  clusters,
  current,
  answers,
  flagged,
  onSelect,
  activeSection,
  showOnlyFlagged, // nuevo
}: {
  // ...tipos existentes...
  showOnlyFlagged?: boolean;
}) {
```

En el `className` del botón de cada pregunta, añade una condición extra:

```tsx
className={cn(
  "num relative grid aspect-square place-items-center rounded-lg border text-xs font-semibold transition-colors",
  i === current && "ring-2 ring-ring ring-offset-1 ring-offset-background",
  i !== current && clusterTitle && "ring-1 ring-accent/40",
  showOnlyFlagged && !flagged[q.id] && i !== current && "opacity-20 pointer-events-none",
  locked && "cursor-not-allowed opacity-40",
  // ...resto igual...
)}
```

`pointer-events-none` evita que se pueda hacer clic en las no marcadas mientras el
filtro está activo, sin necesidad de tocar la lógica de `onClick` ni de `disabled`.

## Resumen

| Botón | Dónde | Alcance |
|---|---|---|
| Primera sin responder | Junto a "Anterior"/"Siguiente" | Solo dentro del bloque de 60 actual |
| Ver solo marcadas | Junto al mapa de navegación | Atenúa (no oculta) las no marcadas del bloque actual, clic desactivado en ellas mientras el filtro está activo |
