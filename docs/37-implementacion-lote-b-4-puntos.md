# Implementación de los 4 puntos accionables del lote B (180 preguntas oficiales PMI)

## 1. Nuevo error_type: "unsupervised_delegation"
Confirmado en §7.2 del spec — patrón no cubierto por los 9 tipos anteriores.
Añadido a `admin_generation_jobs` y `admin_generate_case_cluster` (los 2 únicos
generadores que producen distractores con `error_type`). Ahora 10 tipos válidos.

## 2. Estilo de "verbo compuesto" en la respuesta correcta
§7.2: la correcta rara vez es una acción única y drástica, tiende a combinar
análisis + acción. Añadido como guía de ESTILO en ambos generadores, con una
cautela explícita: no convertirlo en una pista mecánica (se pide variar la
redacción y que algún distractor también suene "compuesto"), para no hacer las
preguntas adivinables por forma de redacción en vez de por juicio real.

## 3. Estructura narrativa de 5 beats para clusters de caso
§7.1 — confirmada en los 2 case studies oficiales del lote B. Implementada en
`admin_generate_case_cluster`:
- Constante `CASE_STUDY_BEATS` con los 5 momentos (tensión de valor →
  interesados desiguales → presión externa → crisis operativa → cierre/
  institucionalización).
- Función `pickBeatsForCount()` reparte los beats proporcionalmente si el
  cluster tiene menos de 5 preguntas (nunca solo los primeros beats).
- Instrucción de "mecánica del cluster": las preguntas no repiten el texto del
  escenario, solo lo referencian y añaden un dato incremental nuevo.

**Verificado con una generación real de 5 preguntas**: el resultado siguió el
arco exactamente (ver journal de la sesión) — tensión de "qué significa éxito"
→ interesada nueva no consultada → presión de competidor → crisis con jefes de
servicio amenazando con retirarse → cierre pidiendo institucionalizar la mejora.

## 4. Temas nuevos confirmados (§7.7)
Añadidos como bloque de "temas a considerar si encajan" (no forzados) en ambos
generadores: gobernanza de decisiones con IA, institucionalización de lecciones
aprendidas, juicio sobre cuándo NO escalar, integridad/transparencia de datos
de reporte, adaptación de comunicación a audiencias divergentes, realización de
beneficios post-entrega.

## Punto NO implementado (pendiente por decisión conjunta)
**§7.5 — practicum tipo "dashboard con tensión entre dos métricas"** (ej.
sostenibilidad mejorando mientras velocidad empeora). Es un tipo de practicum
genuinamente nuevo, no una mejora de los generadores deterministas existentes
(EVM, diagrama de red, hotspot de clasificación) — requeriría un generador
nuevo. Se dejó pendiente de decisión explícita del usuario.

## Verificación
Ambos generadores probados con generaciones reales tras el despliegue — sin
errores, contenido revisado manualmente confirma que la estructura de beats y
el resto de guías se aplican correctamente. Datos de prueba limpiados.
