# Actualización del glosario PMP de la app (agosto 2026)

Se usó el diccionario terminológico completo (331 entradas, ver
`docs/diccionario-terminologico/`) para auditar y ampliar la tabla
`glossary_terms` (usada por `/glosario` en el frontend).

## Correcciones (3 términos existentes con terminología incorrecta)
- "Estructura de desglose del trabajo (EDT)" → "WBS (estructura de desglose
  del trabajo)" -- el diccionario marca "EDT" explícitamente como forma
  desaconsejada, nunca debe reproducirse en contenido nuevo.
- "Backlog del producto" → "Trabajo pendiente asociado al producto (Product
  Backlog)" -- forma preferente de examen según el diccionario.
- "Refinamiento del backlog" → "Perfeccionamiento de la lista de trabajo
  pendiente" -- forma preferente de examen según el diccionario.

Verificado con un barrido completo (mismo patrón de auditoría usado en el
banco de preguntas) que no quedan más restos de terminología incorrecta en
el resto del glosario.

## Ampliación (21 términos nuevos, de 45 a 66)
Extraídos de las categorías "términos estables" y "reglas conceptuales" del
diccionario -- huecos reales que no estaban cubiertos:

**General (14 nuevos)**: Director del proyecto, Patrocinador del proyecto,
Oficina de dirección de proyectos (PMO), Problema (Issue), Verificación,
Validación, Terminación vs. cierre, Involucramiento de los interesados,
Supuesto vs. restricción, Control integrado de cambios, Liderazgo de
servicio, Empoderamiento/delegación/autonomía, Coaching, Incertidumbre vs.
riesgo, Umbral de escalación.

**Predictivo (4 nuevos)**: Intensificación (Crashing), Ejecución rápida
(Fast Tracking), Presupuesto hasta la conclusión (BAC), Variación a la
conclusión (VAC).

**Ágil (2 nuevos)**: Definición de listo (Definition of Ready), Registro de
impedimentos.

Distribución final: 29 general / 21 predictivo / 16 ágil = 66 términos.

Verificado visualmente en navegador real (login con usuario real, búsqueda
funcional, categorías correctas, sin duplicados).
