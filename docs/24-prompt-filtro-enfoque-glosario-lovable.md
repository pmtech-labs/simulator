# Prompt para Lovable — Filtro de práctica por enfoque + Glosario

> Pega esto en el chat de Lovable. Backend ya desplegado y verificado con pruebas
> reales (contra base de datos, no solo en teoría).

## 1. Filtro de práctica por enfoque en `/practica`

`start_exam` acepta ahora un campo opcional `approach_filter` en el body, con estos
valores: `"predictive"` | `"agile"` | `"hybrid"` | `"agile_hybrid"` (combinado ágil +
híbrido). Solo aplica a los modos de práctica (no a `full_sim`, que ya tiene su propio
reparto real).

Añade en `/practica`, junto a los selectores que ya existen (dominio/lección), un
selector adicional **"Enfoque"** con estas opciones:

- Todos los enfoques (no envía `approach_filter`, comportamiento actual sin cambios)
- Predictivo
- Ágil + Híbrido
- Solo Ágil
- Solo Híbrido

```ts
await supabase.functions.invoke("start_exam", {
  method: "POST",
  body: {
    mode: "custom", // o el modo que corresponda
    question_count: 20,
    approach_filter: "agile_hybrid", // o "predictive" | "agile" | "hybrid" | undefined
  },
});
```

Si el filtro elegido no tiene suficientes preguntas disponibles, `start_exam` ya
devuelve un error 404 ("No hay preguntas disponibles para estos filtros") — muéstralo
como mensaje amigable en vez de un error genérico.

## 2. Página de Glosario (nueva, `/glosario`)

Nueva tabla pública `glossary_terms` (columnas: `term`, `definition`, `category` con
valores `'predictive'`, `'agile'`, `'general'`). Es de lectura pública (no requiere
sesión), así que puede ser accesible incluso sin haber iniciado sesión.

```ts
const { data } = await supabase
  .from("glossary_terms")
  .select("term, definition, category")
  .order("term");
```

Diseño:
- Índice alfabético A-Z arriba (como vimos en el competidor), con anclas que saltan a
  cada letra.
- Buscador simple por texto (filtra sobre `term` y `definition` en el cliente, no hace
  falta full-text search en el backend para 45 términos).
- Filtro opcional por categoría (Todos / General / Predictivo / Ágil).
- Cada término como una tarjeta o fila: nombre en negrita + definición debajo.
- Enlázalo desde el menú de navegación (junto a "Mi Progreso" o donde tenga más
  sentido) y desde la página de Instrucciones si ya existe.

## 3. Nota de contenido (importante, no técnica)

Las 45 definiciones del glosario están redactadas desde cero, en palabras propias —
ninguna es una cita textual de PMBOK ni de ninguna fuente con copyright. Si en el
futuro se añaden más términos (por IA o manualmente), debe mantenerse ese mismo
criterio: definiciones cortas y propias, nunca copiadas o parafraseadas de cerca de
material con derechos de autor de terceros.
