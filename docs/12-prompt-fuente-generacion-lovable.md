# Añadido al prompt de Lovable — Fuente de generación en la cola de revisión

> Pega esto en el chat de Lovable. Ajusta `/admin/review` (y opcionalmente `/admin/index` si muestra
> también un listado de preguntas).

## Contexto

`admin_questions` (GET) ya devuelve, para cada pregunta, estos campos nuevos — no hace falta tocar el
backend, solo consumirlos en el frontend:

- `generation_provider`: `"anthropic" | "openai" | "openai_compatible" | "google" | null`
- `generation_model_id`: el modelo exacto usado (ej. `"claude-sonnet-5"`, `"gpt-4.1"`), o `null`
- `generation_connector_name`: el nombre descriptivo del conector (ej. `"Anthropic - producción"`), o `null`

`null` en estos tres campos significa que la pregunta se creó manualmente (sin pasar por un job de
generación) o que el conector que la generó ya no existe.

## Cambios en `/admin/review`

- Añade una columna **"Generado con"** en la tabla de preguntas (o un badge si el diseño es de tarjetas):
  muestra `generation_model_id` si existe (ej. "claude-sonnet-5"), o **"Manual"** si es `null`.
- En la vista expandida/detalle de una pregunta, muestra la línea completa:
  `Generado con {generation_connector_name} ({generation_provider} · {generation_model_id})` — o
  "Creado manualmente" si los campos son null.
- Añade **`generation_model_id` como columna filtrable/ordenable** si la tabla ya soporta filtros por
  columna, para poder responder preguntas como "¿cuántas preguntas generó Sonnet 5 frente a GPT-4.1?" de
  un vistazo.
- Si ya tienes el filtro por `job_id` (de un prompt anterior), añade junto a él un filtro rápido por
  proveedor/modelo — puede ser el mismo desplegable poblado con los proveedores/modelos distintos que
  aparezcan en los resultados actuales, sin necesidad de una llamada nueva al backend.
