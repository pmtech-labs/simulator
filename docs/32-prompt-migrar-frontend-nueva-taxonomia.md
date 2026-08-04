# Prompt para Lovable — Migrar el panel admin a la nueva taxonomía de etiquetas

> Backend ya listo y verificado. Esto es puramente frontend — el motivo por el que
> no ves Formato ni (en muchos casos) Temática en el panel es que esas pantallas
> siguen leyendo las columnas antiguas (`process_group`/`performance_domain`/
> `focus_tags`, de un solo valor cada una), que ya NO son la fuente de verdad.

## Contexto

Desde hace un tiempo, cada pregunta tiene sus etiquetas reales en la tabla
`question_tags` (y expuestas como array `tag_codes` en `v_question_stats` /
`v_questions_public`), con 6 tipos:

| Tipo | Código | Excluyente | Ejemplo |
|---|---|---|---|
| Dominio | DO | Sí | DOPE, DOPR, DOEN |
| Ciclo de vida | CI | Sí | CIPR, CIAH |
| Área de enfoque | AE | No (puede haber varias) | AEIN, AEPL, AEEJ, AEMC, AECI |
| Dominio de desempeño | DD | No (puede haber varias) | DDGO, DDAL, DDCR, DDFI, DDRE, DDRI, DDIN |
| Formato | FO | Sí | FOTU, FOTM, FOCE, FOIN |
| Nueva Temática | NT | No (varias o NTRE si ninguna) | NTEV, NTSO, NTIA, NTRE |

`process_group`/`performance_domain`/`focus_tags` (las columnas antiguas) se
mantienen en las respuestas solo por compatibilidad, pero **ya no reflejan del
todo la realidad** — por ejemplo, no existe ningún equivalente antiguo para
Formato, y muchas preguntas con `focus_tags` vacío en realidad sí tienen una
etiqueta NT real (`NTRE`, "Resto") que no aparece en esa columna.

## 1. Nuevo lookup de etiquetas — reemplaza a `questionTags.ts`

En vez de mantener las etiquetas hardcodeadas en el frontend, tráelas de la tabla
`question_tag_defs` (de lectura pública, ya con RLS abierta para
`authenticated`/`anon`):

```ts
// src/lib/questionTagDefs.ts (nuevo, reemplaza src/lib/questionTags.ts)
import { supabase } from "@/lib/supabaseClient"; // usa el cliente que ya exista en el proyecto

export interface TagDef {
  code: string;
  tag_type: string; // "DO" | "CI" | "AE" | "DD" | "FO" | "NT"
  tag_type_label: string; // "Dominio", "Ciclo de vida", "Área de enfoque", "Dominio de desempeño", "Formato", "Nueva temática"
  label: string; // "Personas", "Predictivo", "Inicio", etc.
  exclusive: boolean;
  sort_order: number;
}

let cached: TagDef[] | null = null;

export async function getTagDefs(): Promise<TagDef[]> {
  if (cached) return cached;
  const { data, error } = await supabase
    .from("question_tag_defs")
    .select("*")
    .order("tag_type")
    .order("sort_order");
  if (error) throw error;
  cached = data ?? [];
  return cached;
}

export async function getTagLabel(code: string): Promise<string> {
  const defs = await getTagDefs();
  return defs.find((d) => d.code === code)?.label ?? code;
}
```

Para componentes que no pueden ser async fácilmente, usa un hook simple:

```ts
// src/hooks/useTagDefs.ts
import { useEffect, useState } from "react";
import { getTagDefs, type TagDef } from "@/lib/questionTagDefs";

export function useTagDefs() {
  const [defs, setDefs] = useState<TagDef[]>([]);
  useEffect(() => { getTagDefs().then(setDefs); }, []);
  const labelOf = (code: string) => defs.find((d) => d.code === code)?.label ?? code;
  const typeLabelOf = (code: string) => defs.find((d) => d.code === code)?.tag_type_label ?? code.slice(0, 2);
  return { defs, labelOf, typeLabelOf };
}
```

## 2. `src/services/adminService.ts` — añadir `tag_codes`

```ts
export interface AdminQuestion {
  // ...campos existentes (deja process_group/performance_domain/focus_tags, no los borres)...
  tag_codes?: string[] | null; // NUEVO -- fuente de verdad real, array con TODOS los códigos
}

export interface QuestionStatRow {
  // ...campos existentes...
  tag_codes?: string[] | null; // NUEVO
}
```

`QuestionFilters` — añade filtro por código de etiqueta (sustituye a
`process_group`/`performance_domain` como forma principal de filtrar, aunque
puedes dejar los antiguos si quieres seguir soportándolos):

```ts
export interface QuestionFilters {
  // ...
  tag_code?: string; // ej. "AEMC" o "AEMC,DDRI" (varios separados por coma = Y lógico)
}
```

En `listQuestions()`, añade `tag_code: filters.tag_code` al query — el backend
(`admin_questions`) ya acepta este parámetro.

## 3. `src/routes/admin.review.tsx` — mostrar y filtrar por `tag_codes`

Sustituye el bloque de badges que hoy usa `PROCESS_GROUP_LABELS`/
`PERFORMANCE_DOMAIN_LABELS`/`FOCUS_TAG_LABELS` (líneas ~405-430 y ~510-522) por
uno que recorra `q.tag_codes` con el hook `useTagDefs`:

```tsx
const { labelOf, typeLabelOf } = useTagDefs();

// ...
<div className="flex flex-wrap gap-1">
  {(q.tag_codes ?? []).map((code) => (
    <span
      key={code}
      title={typeLabelOf(code)}
      className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
    >
      {labelOf(code)}
    </span>
  ))}
</div>
```

Esto automáticamente muestra las 6 dimensiones (incluido Formato, que antes no
aparecía en absoluto, y Nueva Temática incluyendo `NTRE`/"Resto" cuando aplica),
sin depender de qué columnas antiguas tuvieran o no valor.

**Filtros**: sustituye (o añade junto a) los `<select>` de "Área de enfoque" y
"Dominio de desempeño" un selector genérico por tipo de etiqueta, o simplemente
añade dos más para Formato y Nueva Temática siguiendo el mismo patrón que ya
tienes, usando `getTagDefs()` filtrado por `tag_type` para poblar las opciones:

```tsx
const [tagCodeFilter, setTagCodeFilter] = useState("");
// ...
<select value={tagCodeFilter} onChange={(e) => setTagCodeFilter(e.target.value)}>
  <option value="">Todas las etiquetas</option>
  {defs.map((d) => (
    <option key={d.code} value={d.code}>{d.tag_type_label} — {d.label}</option>
  ))}
</select>
```

Y pásalo como `tag_code: tagCodeFilter || undefined` al `filters` que ya se manda a
`listQuestions`.

## 4. `src/routes/admin.index.tsx` — dashboard

Mismo cambio en las 2 tablas de estadísticas (más falladas/más usadas) y en el
bloque "Representación por etiqueta": en vez de calcular `processCounts`/
`performanceCounts`/`focusCounts` a partir de las columnas antiguas (líneas
~250-260), calcúlalos recorriendo `r.tag_codes` y agrupando por `tag_type` (vía
`getTagDefs()`), para que salgan las 6 dimensiones reales, no solo 3.

```ts
const countsByType: Record<string, Record<string, number>> = {};
for (const r of rows) {
  for (const code of r.tag_codes ?? []) {
    const type = code.slice(0, 2); // o typeLabelOf si prefieres agrupar por label
    countsByType[type] ??= {};
    countsByType[type][code] = (countsByType[type][code] ?? 0) + 1;
  }
}
```

## 5. `src/components/admin/QuestionDetailDialog.tsx`

Mismo patrón: sustituye la línea de metadatos (`Estado: ... · Enfoque: ... ·
Formato: ...`) por un recorrido de `q.tag_codes` con `labelOf`.

## Resumen de archivos a tocar

| Archivo | Qué cambia |
|---|---|
| `src/lib/questionTagDefs.ts` (nuevo) | Reemplaza `questionTags.ts` — trae las etiquetas de `question_tag_defs` en vez de hardcodearlas |
| `src/hooks/useTagDefs.ts` (nuevo) | Hook de conveniencia para componentes React |
| `src/services/adminService.ts` | Añadir `tag_codes` a `AdminQuestion`/`QuestionStatRow`, `tag_code` a `QuestionFilters` |
| `src/routes/admin.review.tsx` | Badges y filtro basados en `tag_codes` (ahora sí aparece Formato) |
| `src/routes/admin.index.tsx` | Dashboard con las 6 dimensiones reales, no solo 3 |
| `src/components/admin/QuestionDetailDialog.tsx` | Mismo patrón de badges |
