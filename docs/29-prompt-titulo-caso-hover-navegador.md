# Prompt para Lovable — Título del caso al pasar el ratón en el navegador de preguntas

> Puramente frontend, no requiere backend (session.clusters ya tiene la info).

## Contexto

En `src/components/exam/QuestionNavigator.tsx`, los botones numerados se agrupan
hoy solo por `sectionNumber` (Sección 1/2/3). Dentro de una sección, varias
preguntas consecutivas pueden pertenecer al mismo caso/escenario (`clusterId`
compartido), pero visualmente todos los botones se ven idénticos — no hay forma de
saber, sin hacer clic, que un grupo de botones pertenece al mismo caso.

## Cambio pedido

Dentro de cada sección, sub-agrupar los botones consecutivos que comparten
`clusterId`, y mostrar el **título del caso al pasar el ratón** sobre ese
sub-grupo (tooltip nativo con el atributo `title`, más un borde sutil que englobe
visualmente los botones del mismo caso).

## 1. Pasar los clusters al componente

En **`src/routes/examen.tsx`**, las dos llamadas a `<QuestionNavigator ...>` (una en
el `<aside>` de escritorio, otra en el panel móvil) necesitan un prop nuevo:

```tsx
<QuestionNavigator
  questions={questions}
  clusters={session.clusters}
  current={index}
  answers={answers}
  flagged={flagged}
  onSelect={setIndex}
  activeSection={sections.length > 1 ? section.sectionNumber : undefined}
/>
```

(Añádelo en ambas llamadas, con los mismos props que ya tienen cada una.)

## 2. `src/components/exam/QuestionNavigator.tsx`

Añade `clusters` a los props del componente:

```tsx
import type { Question, CaseCluster } from "@/types/exam";

export function QuestionNavigator({
  questions,
  clusters,
  current,
  answers,
  flagged,
  onSelect,
  activeSection,
}: {
  questions: Question[];
  clusters?: Record<string, CaseCluster>;
  current: number;
  answers: Record<string, unknown>;
  flagged: Record<string, boolean>;
  onSelect: (i: number) => void;
  activeSection?: number;
}) {
```

Dentro de cada sección (donde hoy se renderiza `items.map(({ q, i }) => ...)` en un
único `<div className="grid ...">`), sub-agrupa `items` por `clusterId`
consecutivo (igual que ya hace `groupClusters`/`toBlocks` en el backend: un cluster
= un bloque de botones consecutivos) y envuelve cada bloque de caso en un
contenedor con borde sutil + `title` con el nombre del caso:

```tsx
{groupConsecutiveByCluster(items).map((block, blockIdx) => {
  const clusterTitle = block[0].q.clusterId ? clusters?.[block[0].q.clusterId]?.title : undefined;
  return (
    <div
      key={blockIdx}
      title={clusterTitle}
      className={cn(
        "contents",
        clusterTitle && "rounded-lg ring-1 ring-border/70 p-1 [display:grid] [grid-template-columns:subgrid]",
      )}
    >
      {block.map(({ q, i }) => (
        // ...el mismo <button> que ya existe hoy, sin cambios...
      ))}
    </div>
  );
})}
```

> Nota de implementación: usar `display: contents` + `grid-template-columns:
> subgrid` puede no encajar bien con el `grid grid-cols-8 ...` existente según el
> soporte del navegador objetivo. Si `subgrid` da problemas, una alternativa más
> simple y robusta: en vez de un contenedor envolvente, añade el `title` con el
> nombre del caso **directamente en cada `<button>` individual** que pertenezca a
> un cluster (mismo tooltip nativo, sin necesidad de tocar el layout de grid), y
> añade un borde de color sutil (ej. `ring-1 ring-accent/40`) a esos botones para
> distinguirlos visualmente como parte de un caso, sin necesidad de agruparlos en
> un contenedor propio.

Función auxiliar para sub-agrupar por cluster consecutivo (colócala arriba del
componente, junto al resto de helpers):

```ts
function groupConsecutiveByCluster(items: { q: Question; i: number }[]) {
  const blocks: { q: Question; i: number }[][] = [];
  for (const item of items) {
    const last = blocks[blocks.length - 1];
    if (item.q.clusterId && last?.[0]?.q.clusterId === item.q.clusterId) {
      last.push(item);
    } else {
      blocks.push([item]);
    }
  }
  return blocks;
}
```

## Resultado esperado

Al pasar el ratón sobre cualquier botón que pertenezca a un caso/escenario, el
navegador muestra el título de ese caso (ej. "Lanzamiento de la app CityTasks") en
un tooltip nativo, y los botones de ese mismo caso quedan visualmente agrupados
(borde compartido o individual, según la opción de implementación elegida arriba).
Los botones de preguntas independientes (sin `clusterId`) se quedan exactamente
como están hoy.
