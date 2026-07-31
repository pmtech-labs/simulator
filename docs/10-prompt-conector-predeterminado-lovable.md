# Añadido al prompt de Lovable — Conector LLM predeterminado

> Pega esto en el chat de Lovable. Ajusta `/admin/connectors` y el formulario de `/admin/generate`.

## Contexto

`llm_connectors` ahora tiene dos campos distintos, no uno:
- `is_active` (como ya existía): el conector puede seleccionarse en el formulario de generación.
  Pueden estar activos varios a la vez — es intencional, para poder comparar calidad de generación
  entre proveedores en distintos jobs.
- `is_default` (nuevo): el conector que se preselecciona automáticamente al abrir el formulario de
  generación. **Es exclusivo — la base de datos ya garantiza que solo uno puede tener
  `is_default = true` a la vez** (un trigger desmarca los demás automáticamente), así que el frontend
  no necesita lógica adicional para eso, solo reflejar el estado.

## Cambios en `/admin/connectors`

- En la tabla de conectores, añade una columna o badge "Predeterminado" — muestra una estrella o
  badge solo en el conector con `is_default = true`.
- Añade una acción "Marcar como predeterminado" por fila (botón o icono de estrella clicable). Al
  pulsarla, llama a `PATCH admin_connectors` con `{ id, is_default: true }`. Refresca la lista tras
  la respuesta — verás que el badge se mueve automáticamente al nuevo conector y desaparece del
  anterior (lo hace el trigger de BD, no hace falta lógica extra en el frontend).
- No permitas desmarcar el predeterminado directamente sin marcar otro — no tiene sentido dejar
  "ningún" conector predeterminado. Si quieres permitir "ninguno", puedes añadir una opción explícita
  "Sin predeterminado" que mande `is_default: false`, pero no es necesario para el MVP.

## Cambio en `/admin/generate`

- El selector de "Conector LLM a usar" debe **preseleccionar automáticamente** el conector con
  `is_default = true` al cargar la pantalla (en vez de dejarlo vacío o elegir el primero de la
  lista). El admin puede cambiarlo igualmente si quiere probar otro conector activo para ese job en
  concreto — la preselección es solo una comodidad, no una restricción.
