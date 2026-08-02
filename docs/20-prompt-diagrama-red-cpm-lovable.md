# Prompt para Lovable — Renderizar diagramas de red (CPM/PDM) en preguntas graphic_based

> Pega esto en el chat de Lovable. Extiende el manejo de `format === "graphic_based"` en
> `/examen`, que hoy solo sabe renderizar `chart_type === "earned_value"`.

## Contexto

Ya existe una pregunta real publicada de este tipo nuevo (inspirada en un formato que
usan competidores: diagramas de red del método de diagramación por precedencia — PDM —
con cálculo de ruta crítica). El `practicum_payload` de esta pregunta trae:

```json
{
  "chart_type": "network_diagram",
  "diagram_svg": "<svg viewBox=\"0 0 750 300\">...</svg>"
}
```

A diferencia de `earned_value` (que usa el componente `EarnedValueChart` con datos
estructurados), `network_diagram` trae el diagrama ya renderizado como **SVG inline
completo** — mismo patrón que ya usáis para `hotspot` (`diagram_svg` + `dangerouslySetInnerHTML`
o parseo seguro equivalente), solo que aquí no hay zonas clicables, es puramente
ilustrativo para que el candidato razone sobre él.

## Cambio necesario

En el bloque donde ya manejáis `q.format === "graphic_based"` (donde hoy comprobáis
`q.practicum_payload?.chart_type === "earned_value"`), añade el caso nuevo:

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
```

- Igual que con `hotspot`, si preferís no usar `dangerouslySetInnerHTML` por convención
  del proyecto, aplicad el mismo mecanismo de parseo seguro que ya usáis ahí — el SVG
  viene de nuestra propia base de datos (contenido generado/curado por el equipo
  editorial, nunca por el candidato), así que el riesgo de XSS es el mismo que ya
  asumís con `hotspot`.
- El diagrama es ancho (viewBox 750x300) — el `overflow-x-auto` es importante para que
  no rompa el layout en móvil; que se pueda hacer scroll horizontal si hace falta.
- No hace falta ninguna lógica de interacción nueva — el candidato solo lee el diagrama
  y responde entre las opciones normales (`mc_single`), igual que con `earned_value`.

## Nota para futuras preguntas de este tipo

Cada caja del diagrama sigue el formato PDM estándar: fila superior (inicio temprano |
duración | fin temprano), nombre de la actividad en el centro, fila inferior (inicio
tardío | holgura | fin tardío). Las actividades en la ruta crítica (holgura total = 0)
se resaltan en azul; el resto en gris — así el candidato puede identificarlas visualmente
además de por el cálculo, si el enunciado lo permite.

## Generación de más preguntas de este tipo (nuevo, sin IA)

Ya existe una segunda Edge Function, `generate_network_diagram_question`, que genera
este tipo de preguntas **sin usar ningún LLM** — toda la matemática (topología de red,
cálculo de ruta crítica, distractores) se calcula por código determinista, precisamente
porque los modelos de IA no son fiables haciendo aritmética de grafos con varias ramas
paralelas. Verificado con pruebas reales: la matemática es correcta en el 100% de los
casos generados.

Añade en `/admin/generate` (o en una sección aparte, como prefiráis) un botón
**"Generar preguntas de diagrama de red (CPM/PDM)"** independiente del formulario de
generación por IA existente, ya que esta función tiene una firma distinta (no pide
conector ni approach, solo tarea ECO y cantidad):

```ts
const { data, error } = await supabase.functions.invoke("generate_network_diagram_question", {
  method: "POST",
  body: { task_id: selectedTaskId, count: 5 },
});
// data: { generated: number, requested: number, question_ids: string[] }
```

- El selector de tarea ECO puede reutilizar el mismo componente que ya usáis en el
  formulario de generación por IA (agrupado por dominio).
- Muestra el resultado igual que con los jobs de IA: "5 de 5 generadas" — aquí no debería
  haber fallos salvo error de conexión, ya que no depende de ningún modelo externo.
- Las preguntas generadas entran igual en la cola de revisión (`status: 'draft'`), y en
  la columna "Generado con" (del prompt de trazabilidad anterior) deben aparecer como
  **"Manual"** — es correcto y esperado, ya que no hay ningún conector LLM involucrado,
  aunque el proceso esté automatizado por código.
