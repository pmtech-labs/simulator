# Recomendación de modelos LLM + fix de parámetros de tokens (agosto 2026)

## 1. Modelos recomendados (búsqueda en vivo, agosto 2026)

### Gemini — sin cambios
`gemini-3.6-flash` ya es el modelo Gemini de mayor puntuación del catálogo actual
(líder BenchLM agosto 2026) y la versión GA más reciente de la familia 3.x Flash.
No hace falta cambiarlo.

### OpenAI — actualizar de gpt-4.1 a gpt-5.4
`gpt-4.1` se retiró de ChatGPT el 13 feb 2026 (sigue respondiendo por API, sin
compromiso de cuánto tiempo más). Recomendado: **gpt-5.4** ($2,50/$15 por 1M
tokens) — descrito como "el caballo de batalla", el punto de partida por defecto
recomendado para uso general. Alternativa más barata si se quiere recortar coste:
gpt-5.4-mini ($0,75/$4,50).

## 2. Bug real encontrado y corregido: parámetro de tokens

**OpenAI**: desde los modelos de razonamiento (o1/o3/o4) y toda la familia GPT-5.x,
la API exige `max_completion_tokens` en vez de `max_tokens` -- enviar `max_tokens`
devuelve un 400 duro. Nuestro código enviaba siempre `max_tokens` sin importar el
modelo -- si se hubiera cambiado el conector a gpt-5.4 sin este fix, todas las
generaciones habrían fallado inmediatamente.

Corregido en `_shared/llmProviders.ts`: se detecta la familia del modelo por su
nombre (`/^(o1|o3|o4|gpt-5|gpt-6)/i`) y se usa el parámetro correcto, sin romper
compatibilidad con modelos anteriores (gpt-4o, gpt-4.1) ni con otros proveedores
"compatibles con OpenAI" que puedan seguir esperando `max_tokens`.

**Gemini**: encontrado un cabo suelto -- un comentario en el código mencionaba
`thinkingBudget: 0` para evitar que el razonamiento interno del modelo consumiera
parte de `maxOutputTokens` y truncara el JSON final, pero ese campo ya no estaba
presente en la llamada real (quedó como comentario fantasma). Los modelos Gemini 3
Flash usan por defecto `thinkingLevel: "high"` -- justo el escenario que ese
comentario advertía. Corregido con el parámetro nuevo real:
`generationConfig.thinkingConfig.thinkingLevel: "low"` (el antiguo `thinkingBudget`
entero está deprecado y no se puede mezclar con `thinkingLevel` en la misma
petición, da 400).

## Verificación

Los 4 generadores (`admin_generation_jobs`, `admin_generate_case_cluster`,
`admin_generate_matching_question`, `admin_generate_hotspot_question`) probados
con generaciones reales tras el despliegue -- todos funcionan sin errores con
ambos fixes activos. Datos de prueba limpiados.
