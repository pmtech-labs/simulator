# Prompt para Lovable — Mostrar y filtrar por las nuevas etiquetas (grupo de proceso, dominio de desempeño, temáticas)

> Pega esto en el chat de Lovable. El backend ya expone estos 3 campos en todas las
> APIs relevantes (verificado con llamadas reales) — este prompt es solo para
> mostrarlos y añadir sus filtros en el frontend.

## Contexto

Desde hace unas sesiones, cada pregunta lleva 3 etiquetas nuevas que **no se veían en
ningún sitio del frontend, ni en usuario ni en admin**:

- `process_group`: `initiation` | `planning` | `execution` | `monitoring_control` | `closing`
- `performance_domain`: `gobernanza` | `alcance` | `cronograma` | `finanzas` | `recursos` | `riesgos` | `interesados`
- `focus_tags`: array, puede tener varios a la vez: `entrega_valor`, `sostenibilidad`, `ia` (o vacío)

Causa raíz (ya arreglada en backend): las vistas `v_question_stats` y
`v_questions_public`, y las Edge Functions `admin_questions` y `start_exam`, se
crearon/actualizaron antes de que existieran estas columnas, así que ni siquiera
llegaban al frontend. Ya lo corregí — ahora sí llegan en cada respuesta.

## 1. Tipos compartidos

**`src/types/exam.ts`** — añade estos 3 campos a `Question`:

```ts
export type ProcessGroup = "initiation" | "planning" | "execution" | "monitoring_control" | "closing";
export type PerformanceDomain = "gobernanza" | "alcance" | "cronograma" | "finanzas" | "recursos" | "riesgos" | "interesados";
export type FocusTag = "entrega_valor" | "sostenibilidad" | "ia";

export interface Question {
  // ...campos existentes...
  processGroup?: ProcessGroup;
  performanceDomain?: PerformanceDomain;
  focusTags?: FocusTag[];
}
```

**`src/services/adminService.ts`** — añade a `AdminQuestion` (junto a `approach`,
`difficulty` existentes):

```ts
export interface AdminQuestion {
  // ...campos existentes...
  process_group?: string | null;
  performance_domain?: string | null;
  focus_tags?: string[] | null;
}
```

Y a `QuestionFilters` (junto a `domain_code`, `task_id`, `approach`):

```ts
export interface QuestionFilters {
  // ...campos existentes...
  process_group?: string;
  performance_domain?: string;
}
```

En `listQuestions()`, añade estos dos al objeto `query` que ya arma la petición GET
(junto a `domain_code: filters.domain_code`, etc.):

```ts
process_group: filters.process_group,
performance_domain: filters.performance_domain,
```

## 2. Etiquetas de referencia (para los `<select>` y las traducciones a español)

Usa estos labels en todos los sitios de abajo:

```ts
const PROCESS_GROUP_LABELS: Record<string, string> = {
  initiation: "Inicio",
  planning: "Planificación",
  execution: "Ejecución",
  monitoring_control: "Monitoreo y Control",
  closing: "Cierre",
};

const PERFORMANCE_DOMAIN_LABELS: Record<string, string> = {
  gobernanza: "Gobernanza",
  alcance: "Alcance",
  cronograma: "Cronograma",
  finanzas: "Finanzas",
  recursos: "Recursos",
  riesgos: "Riesgos",
  interesados: "Interesados",
};

const FOCUS_TAG_LABELS: Record<string, string> = {
  entrega_valor: "Entrega de valor",
  sostenibilidad: "Sostenibilidad",
  ia: "IA",
};
```

## 3. `src/services/examService.ts` — mapeo de `start_exam` a `Question`

En la función `startExam()`, dentro del `.map((item) => {...})` que construye cada
`Question` (busca donde ya se asigna `difficulty: item.difficulty ?? m?.difficulty ?? 3`),
añade justo al lado:

```ts
processGroup: item.process_group ?? undefined,
performanceDomain: item.performance_domain ?? undefined,
focusTags: (item.focus_tags ?? []) as Question["focusTags"],
```

(El tipo `RawItem` que describe la respuesta cruda de la Edge Function también
necesita estos 3 campos opcionales — añádelos junto a `difficulty` en esa interfaz.)

## 4. `src/routes/examen.tsx` — mostrar los badges al candidato

Busca el bloque de badges existente (el que ya muestra `q.taskCode`, el enfoque
—Predictivo/Ágil/Híbrido—, `difficultyLabel(q.difficulty)` y el formato, todos
como `<span className="rounded-md border border-border px-2 py-1 ...">`). Añade,
con el mismo estilo, badges para:

- Grupo de proceso: `PROCESS_GROUP_LABELS[q.processGroup]` (si existe)
- Dominio de desempeño: `PERFORMANCE_DOMAIN_LABELS[q.performanceDomain]` (si existe)
- Temáticas: un badge por cada elemento de `q.focusTags` (si el array no está vacío),
  usando `FOCUS_TAG_LABELS[tag]` — dale un color ligeramente distinto (ej.
  `border-primary/40 text-primary`) para diferenciarlas visualmente del resto de
  metadatos, ya que son un dato más "temático" que "estructural".

No hace falta tocar la lógica de corrección ni nada más de la pantalla — es
puramente informativo, igual que ya lo son el enfoque y la dificultad.

## 5. `src/routes/practica.tsx` — nuevos filtros de práctica

Junto al `<select>` de "Enfoque" ya existente (busca `APPROACH_LABELS` y
`approachFilter`), añade dos selectores más con el mismo estilo:

```tsx
const [processGroupFilter, setProcessGroupFilter] = useState<string>("");
const [performanceDomainFilter, setPerformanceDomainFilter] = useState<string>("");
```

```tsx
<label className="mt-5 block text-xs font-medium">
  Área de enfoque
  <select
    value={processGroupFilter}
    onChange={(e) => { setProcessGroupFilter(e.target.value); setStartError(null); }}
    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
  >
    <option value="">Todas las áreas</option>
    {Object.entries(PROCESS_GROUP_LABELS).map(([value, label]) => (
      <option key={value} value={value}>{label}</option>
    ))}
  </select>
</label>

<label className="mt-3 block text-xs font-medium">
  Dominio de desempeño
  <select
    value={performanceDomainFilter}
    onChange={(e) => { setPerformanceDomainFilter(e.target.value); setStartError(null); }}
    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
  >
    <option value="">Todos los dominios</option>
    {Object.entries(PERFORMANCE_DOMAIN_LABELS).map(([value, label]) => (
      <option key={value} value={value}>{label}</option>
    ))}
  </select>
</label>
```

Al llamar a `startExam(...)`, pasa estos dos junto a `approachFilter` (mismo patrón:
el backend ya los ignora automáticamente en `full_sim`, así que no hace falta
condicionar nada aquí):

```ts
processGroupFilter: processGroupFilter || undefined,
performanceDomainFilter: performanceDomainFilter || undefined,
```

Y en **`src/services/examService.ts`**, `StartExamParams` necesita los dos campos
nuevos, y el body de la llamada a `start_exam` debe incluirlos:

```ts
...(params.processGroupFilter && params.mode !== "full_sim"
  ? { process_group_filter: params.processGroupFilter }
  : {}),
...(params.performanceDomainFilter && params.mode !== "full_sim"
  ? { performance_domain_filter: params.performanceDomainFilter }
  : {}),
```

## 6. `src/routes/admin.review.tsx` — filtros y badges en el panel admin

**Filtros** (junto a los `<select>` de dominio/tarea/enfoque ya existentes, en la
barra de filtros de arriba):

```tsx
const [processGroup, setProcessGroup] = useState("");
const [performanceDomain, setPerformanceDomain] = useState("");
```

Añade dos `<select>` más con el mismo `inputCls` que ya usan los otros filtros de
esa barra, y añádelos al objeto `filters` que ya se pasa a `listQuestions`:

```ts
process_group: processGroup || undefined,
performance_domain: performanceDomain || undefined,
```

**Badges en la fila expandida**: busca la línea que ya muestra
`Tarea: {q.task_title ?? q.task_id} · Enfoque: {q.approach} · Formato: {q.format} · Tipo: {q.item_type} · Dificultad: {q.difficulty ?? "—"}`
y amplíala:

```tsx
<p className="mt-2 text-xs text-muted-foreground">
  Tarea: {q.task_title ?? q.task_id} · Enfoque: {q.approach} · Formato: {q.format} · Tipo:{" "}
  {q.item_type} · Dificultad: {q.difficulty ?? "—"}
  {q.process_group && ` · Área de enfoque: ${PROCESS_GROUP_LABELS[q.process_group] ?? q.process_group}`}
  {q.performance_domain && ` · Dominio de desempeño: ${PERFORMANCE_DOMAIN_LABELS[q.performance_domain] ?? q.performance_domain}`}
  {q.focus_tags && q.focus_tags.length > 0 && ` · Temáticas: ${q.focus_tags.map((t) => FOCUS_TAG_LABELS[t] ?? t).join(", ")}`}
</p>
```

## 7. `src/components/admin/QuestionDetailDialog.tsx`

Mismo patrón: busca la línea
`Estado: {q.status} · Enfoque: {q.approach} · Formato: {q.format} · Tipo: {q.item_type} · Dificultad: {q.difficulty ?? "—"}`
y amplíala exactamente igual que en el punto 6.

## Resumen de archivos a tocar

| Archivo | Qué se añade |
|---|---|
| `src/types/exam.ts` | Tipos `ProcessGroup`/`PerformanceDomain`/`FocusTag` + campos en `Question` |
| `src/services/adminService.ts` | Campos en `AdminQuestion` y `QuestionFilters` + paso de filtros en `listQuestions` |
| `src/services/examService.ts` | Mapeo en `startExam()` + campos nuevos en `StartExamParams`/`RawItem` + body de la llamada |
| `src/routes/examen.tsx` | 3 badges nuevos (grupo de proceso, dominio de desempeño, temáticas) |
| `src/routes/practica.tsx` | 2 selectores de filtro nuevos (área de enfoque, dominio de desempeño) |
| `src/routes/admin.review.tsx` | 2 selectores de filtro + ampliar la línea de metadatos en la fila expandida |
| `src/components/admin/QuestionDetailDialog.tsx` | Ampliar la misma línea de metadatos |
