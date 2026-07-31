# Añadido al prompt de Lovable — Desplegable de modelos disponibles en conectores

> Pega esto en el chat de Lovable. Ajusta el formulario de alta de conectores en `/admin/connectors`.

## Contexto

Se ha detectado un error real: un conector se creó con `model_id = "GPT-5"` (escrito a mano), que no
existe en la API de OpenAI — el lote de generación falló 10/10 veces con el mismo error. Para evitarlo,
ya existe una nueva Edge Function `admin_list_models` que consulta en vivo los modelos disponibles del
proveedor elegido, usando la API key que el admin acaba de teclear (sin guardarla todavía).

## Cambio en el formulario de alta de conector

Sustituye el campo de texto libre "Modelo" por este flujo:

1. El admin elige el **proveedor** (Anthropic / OpenAI / OpenAI-compatible / Google) y escribe la
   **API key** (y, si aplica, la URL base para OpenAI-compatible).
2. En cuanto proveedor + API key tengan valor (con un pequeño debounce, ej. 500ms tras dejar de teclear,
   o un botón explícito "Comprobar modelos disponibles" si prefieres no disparar llamadas automáticas),
   llama a la Edge Function `admin_list_models`:

   ```ts
   const { data, error } = await supabase.functions.invoke("admin_list_models", {
     method: "POST",
     body: { provider, api_key: apiKey, api_base_url: apiBaseUrl || undefined },
   });
   // data.models: [{ id: string, label?: string }]
   ```

3. Mientras se cargan los modelos, muestra un estado de carga breve en el campo.
4. Si la llamada tiene éxito, sustituye el campo de texto por un **desplegable** con los modelos
   devueltos (usa `label` si existe, si no `id`, y guarda siempre `id` como el valor real de `model_id`).
5. Si la llamada falla (API key inválida, proveedor caído, etc.), muestra el error tal cual lo devuelve
   la función (ya viene en español y explica la causa) y deja el campo de modelo deshabilitado hasta que
   la comprobación tenga éxito — **no permitas guardar el conector sin haber cargado la lista de modelos
   con éxito**, para que sea imposible repetir el error de escribir un modelo inventado o descontinuado.
6. Si el admin cambia el proveedor o la API key después de cargar la lista, vacía el desplegable y
   vuelve a pedir la comprobación antes de permitir guardar.

## Nota de seguridad

La API key viaja en esta llamada de comprobación tal como el admin la ha escrito, pero **nunca se guarda
en esta fase** — la función solo la usa para la consulta y no la persiste en ningún sitio. Solo se guarda
cifrada en Vault cuando el admin confirma la creación del conector con `POST admin_connectors`, como ya
funciona hoy.

## Edición de conectores existentes (nuevo)

Cada fila de la tabla de conectores debe tener también una acción **"Editar"**, además de "Marcar como
predeterminado" y "Desactivar". Al abrir la edición:

- Formulario prellenado con `name`, `provider`, `model_id` y `api_base_url` del conector.
- El campo API key **no se prellena ni se puede leer** (Vault es de solo escritura) — se muestra vacío
  con el texto de ayuda "Déjalo en blanco para mantener la clave actual, o escribe una nueva para
  rotarla".
- Para refrescar el desplegable de modelos sin obligar a rotar la clave, llama a `admin_list_models` con
  `{ connector_id }` en vez de `{ provider, api_key }` — el backend ya soporta este modo y usa la clave
  guardada sin que viaje nunca al navegador:

  ```ts
  const { data } = await supabase.functions.invoke("admin_list_models", {
    method: "POST",
    body: { connector_id: connector.id },
  });
  ```

- Si el admin escribe una clave nueva en el formulario de edición, usa esa clave (modo `{ provider,
  api_key }`) para refrescar el desplegable en su lugar — igual que en creación.
- Al guardar, llama a `PATCH admin_connectors` con `{ id, name?, model_id?, api_base_url?, api_key? }`
  (solo incluye los campos que hayan cambiado; omite `api_key` si el admin no escribió una nueva, para
  no rotarla sin querer).
- Tras rotar la clave de un conector, informa claramente que la clave anterior deja de estar disponible
  y que los jobs de generación ya completados no se ven afectados (siguen trazados al mismo `connector_id`,
  solo cambia qué clave se usa a partir de ahora).
