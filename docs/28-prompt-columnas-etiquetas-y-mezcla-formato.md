# Prompt para Lovable — Columna "Etiquetas" en tablas + mezcla de formato

> El backend ya está listo y verificado con llamadas reales para los 3 puntos de
> abajo. Esto es puramente frontend.

## 1. `src/routes/admin.index.tsx` — columna "Etiquetas" en las tablas de stats

`QuestionStatRow` (en `src/services/adminService.ts`) necesita estos 3 campos
nuevos (el backend ya los devuelve, verificado con llamada real):

```ts
export interface QuestionStatRow {
  // ...campos existentes...
  process_group?: string | null;
  performance_domain?: string | null;
  focus_tags?: string[] | null;
}
```

En `admin.index.tsx`, componente `StatsTable`: añade una columna "Etiquetas" al
`<thead>` (junto a "Dominio"/"Tarea") y una celda por fila que muestre 3 badges
compactos (usa `PROCESS_GROUP_LABELS`, `PERFORMANCE_DOMAIN_LABELS`,
`FOCUS_TAG_LABELS` de `src/lib/questionTags.ts`, que ya existe):

```tsx
<th className="px-3 py-2">Etiquetas</th>
```

```tsx
<td className="px-3 py-2">
  <div className="flex flex-wrap gap-1">
    {r.process_group && (
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {PROCESS_GROUP_LABELS[r.process_group] ?? r.process_group}
      </span>
    )}
    {r.performance_domain && (
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {PERFORMANCE_DOMAIN_LABELS[r.performance_domain] ?? r.performance_domain}
      </span>
    )}
    {(r.focus_tags ?? []).map((t) => (
      <span key={t} className="rounded-md border border-primary/40 px-1.5 py-0.5 text-[10px] font-medium text-primary">
        {FOCUS_TAG_LABELS[t] ?? t}
      </span>
    ))}
  </div>
</td>
```

Aplica esto en **ambas** tablas ("Preguntas más falladas" y "Preguntas más usadas"),
ya que las dos usan el mismo componente `StatsTable`.

## 2. `src/routes/admin.review.tsx` — columna "Etiquetas" en el listado (no solo en el detalle expandido)

Ya se añadió correctamente la info en la fila expandida (al hacer clic) — lo que
falta es una **columna visible directamente en la tabla**, sin tener que expandir
cada fila. Añade una columna nueva al `<thead>` (junto a "Dif." o "Dominio / Tarea"):

```tsx
<th className="px-3 py-2">Etiquetas</th>
```

Y en `QuestionRow`, una celda con los mismos 3 badges compactos que en el punto 1
(mismo estilo, misma lógica) usando `q.process_group`, `q.performance_domain`,
`q.focus_tags` (ya existen en `AdminQuestion` desde el prompt anterior):

```tsx
<td className="px-3 py-2">
  <div className="flex flex-wrap gap-1">
    {q.process_group && (
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {PROCESS_GROUP_LABELS[q.process_group] ?? q.process_group}
      </span>
    )}
    {q.performance_domain && (
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {PERFORMANCE_DOMAIN_LABELS[q.performance_domain] ?? q.performance_domain}
      </span>
    )}
    {(q.focus_tags ?? []).map((t) => (
      <span key={t} className="rounded-md border border-primary/40 px-1.5 py-0.5 text-[10px] font-medium text-primary">
        {FOCUS_TAG_LABELS[t] ?? t}
      </span>
    ))}
  </div>
</td>
```

Ojo con el `colSpan` de la fila de detalle expandida (línea con
`<td colSpan={9} ...>`) — ahora la tabla tiene una columna más, así que ese número
debe subir en 1 (a `10`) para que el detalle expandido siga ocupando todo el ancho.

## 3. `src/routes/admin.generate.tsx` — opción "Mezcla automática" en el desplegable de Formato

Backend ya soporta `format: "mixed"` (rota automáticamente entre `mc_single`,
`mc_multi` y `pulldown` — los únicos 3 formatos que este pipeline de IA genera de
forma fiable; matching/hotspot/graphic_based tienen sus propios generadores
dedicados y no se mezclan aquí).

Añade la opción al array `FORMATS` (justo al principio, mismo patrón que
`APPROACHES` ya tiene con `mixed`):

```ts
const FORMATS = [
  { value: "mixed", label: "Mezcla automática (mc_single/mc_multi/pulldown)", stable: true },
  { value: "mc_single", label: "Opción única (mc_single)", stable: true },
  { value: "mc_multi", label: "Opción múltiple (mc_multi)", stable: true },
  // ...resto igual...
];
```

Y cambia el valor por defecto del estado a `"mixed"` (igual que `approach` ya usa
`"mixed"` por defecto):

```ts
const [format, setFormat] = useState("mixed");
```

**Bug adicional encontrado y hay que arreglarlo de paso**: el array `FOCUS_TAGS`
usa valores en inglés (`"ai"`, `"sustainability"`, `"value_delivery"`) que **no
coinciden** con los que realmente usa el backend (`"ia"`, `"sostenibilidad"`,
`"entrega_valor"`). Si un admin selecciona una temática manual ahí, se está
guardando un valor que no es ninguno de los 3 reales. Corrígelo:

```ts
const FOCUS_TAGS = ["ia", "sostenibilidad", "entrega_valor"];
```

Y si hay labels visibles para esas opciones en el JSX (busca dónde se renderiza
`FOCUS_TAGS`), actualízalos a español: "IA", "Sostenibilidad", "Entrega de valor".
