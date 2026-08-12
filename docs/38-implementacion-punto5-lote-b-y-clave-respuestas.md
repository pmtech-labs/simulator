# Punto 5 (few-shot lote B) + procesamiento de la clave de respuestas oficial

## Parte 1 — Ampliación del pool de few-shot con el lote B

Corrección a la sesión anterior: se había ampliado el pool de ejemplos de estilo
solo con el lote A (200 preguntas ATP). El propio spec de extracción (§9.1) pedía
usar el lote B con MÁS peso que el lote A, y no se había hecho por falta del
corpus en bruto (antes solo tenía el documento de análisis, no las preguntas).

Con las 180 preguntas + 2 case studies en bruto (ZIPs subidos), se implementó:

- `fewShotExamples.ts` reestructurado: `LOTE_A_STYLE_EXAMPLES` (20) +
  `LOTE_B_STYLE_EXAMPLES` (11, seleccionadas priorizando las que el spec ya
  destacaba: Q1, Q48, Q114, Q135→sustituida, Q146, Q148, Q154, Q161, Q176, Q178,
  Q179, Q180). `GENERAL_STYLE_EXAMPLES` combina ambas con el lote B duplicado
  (doble peso en el muestreo aleatorio, según pide el spec).
- `MATCHING_STYLE_EXAMPLES` ampliado a array (antes un solo ejemplo fijo): +2 del
  lote B (Q13 respuesta a riesgos, Q146 dimensiones de sostenibilidad -- el
  ejemplo que el spec señala como el más representativo del focus area).
- Nueva `CASE_CLUSTER_REFERENCE`: escenario + 5 preguntas reales del Caso 1
  oficial del PMI ("Transformación Empresarial y Alineación Estratégica"),
  conectada en `admin_generate_case_cluster` junto a la guía abstracta de 5
  beats ya existente -- ahora el modelo ve un ejemplo end-to-end real, no solo
  la descripción abstracta del arco narrativo.

Desplegado en los 4 generadores, verificado con generaciones reales en los 4
tras el despliegue (sin errores).

## Parte 2 — Clave de respuestas + rationale oficial (180 preguntas)

El usuario completó el examen y compartió el feedback completo (docx con
respuesta correcta marcada + rationale por pregunta). Se parseó
programáticamente a `parsed_questions.json` (180 preguntas, 175 con clave
extraíble automáticamente -- las 5 restantes son las de lista desplegable,
formato distinto, no bloqueante).

### Hallazgo 1 — La hipótesis del "verbo compuesto" (spec §7.2) estaba sobreestimada

El spec original decía que la opción correcta "casi siempre" combina un verbo
analítico con la acción resultante. Verificado contra las 152 preguntas
single-select con clave real:
- Heurística estricta (analizar/evaluar/revisar/determinar/reunirse/consultar):
  **31%** de las correctas.
- Heurística ampliada (+facilitar/adaptar/trabajar con/colaborar/coordinar/
  validar/identificar/discutir/comprender): **42%**.

Muy por debajo de "casi siempre". **Corregido en el system prompt** de
`admin_generation_jobs`: ya no se presenta el patrón de verbo compuesto como
tendencia dominante, sino como una entre varias formas válidas de expresar una
"acción medida y profesional" (que es el rasgo real y consistente, no la forma
concreta de la frase). Se mantiene la advertencia anti-gaming ya existente (no
convertirlo en pista mecánica).

### Hallazgo 2 — Q161 y Q176: mc_multi real no es siempre "elige 2"

Distribución real de nº de correctas en las 23 preguntas multi-select con clave:
- N=2: 15 casos (≈65%)
- N=3: 8 casos (≈35%) -- incluye Q161 ("Seleccione 3 opciones": correctas A, C, D)
  y las de formato abierto "Seleccione todas las que correspondan" (Q176: A, C, E;
  Q177: A, C, E), que en la práctica también convergen a exactamente 3 de 5.
- Ningún caso con N=4 o más.

**Nuestro generador de mc_multi solo soportaba N=2** (hueco funcional real,
señalado por el usuario). Implementado en `admin_generation_jobs`:
- `answerPositionBlock` generalizado para cualquier N (antes hardcodeado a 2).
- `validateDraft` generalizado para validar exactamente N correctas (antes
  hardcodeado a 2).
- Nuevo array `MC_MULTI_TRIPLES` (10 combinaciones de 3 sobre 5 letras) junto al
  `MC_MULTI_PAIRS` ya existente.
- Selección de N=2 vs N=3 con la proporción real observada (65%/35%), rotando
  dentro de cada grupo para variar la posición.

**Verificado con una generación real de 6 mc_multi**: 4 salieron con N=2, 2 con
N=3, todas válidas (6/6, sin fallos). Confirma que la mezcla funciona.

### Documentos guardados
- `docs/lote-b-feedback/parsed_questions.json` — las 180 preguntas parseadas
  (clave + rationale oficial), para consulta futura sin reprocesar el docx.
- `docs/lote-b-feedback/FEEDBACK_180_PREGUNTAS_SIMULACRO_EXAMEN_PMI_ECO_2026.docx`
  — documento original.

### Pendiente (no bloqueante, próxima sesión si se quiere)
- Las 5 preguntas de lista desplegable (Q13, Q75, Q88, Q132, Q146) no se
  parsearon automáticamente (formato de emparejamiento distinto al de opción
  múltiple) -- ya se usó su contenido manualmente para el pool de few-shot de
  matching, así que no es bloqueante, pero si se quiere el parseo completo
  programático habría que adaptar el script.
- El rationale oficial completo (no solo la clave) podría añadirse como capa de
  explicación de referencia en el banco -- mejora pedagógica mencionada en el
  spec §10, no implementada aún por alcance/tiempo de esta sesión.

## Parte 3 — Auditoría del banco completo contra las nuevas especificaciones

Tras el hallazgo del punto anterior, se auditaron las 544 preguntas existentes
contra las reglas duras y contra el hallazgo del verbo compuesto.

### Reglas duras: sin problemas
- `error_type` válido en los 1390 distractores de mc_single/mc_multi: 0 problemas.
- Terminología PMBOK 6 prohibida: 0 violaciones reales (1 falso positivo revisado
  a mano -- "recopilar requisitos de calidad" en prosa descriptiva, no cita el
  nombre formal del proceso PMBOK 6).
- Estructura mc_multi (5 opciones): 65/65 correctas.

### Hallazgo: sobreuso real del patrón de verbo compuesto en el banco existente
Confirmado con la misma heurística usada para el lote B, aplicada a nuestras 406
preguntas mc_single existentes:
- Correcta usa verbo analítico/colaborativo: **62.8%** (banco propio) vs. **42%**
  (lote B real).
- Correcta es la ÚNICA opción con ese patrón (potencialmente adivinable sin
  razonar): **42.4% / 172 preguntas** (banco propio) vs. **21.7%** (lote B real).

Efecto directo del prompt original (ya corregido en esta sesión, solo hacia
delante -- ver Parte 2).

### Decisión (usuario, agosto 2026): dejar las 172 preguntas tal cual
No se borran ni regeneran. Motivo: quedan ~2500 preguntas más por generar para
completar el banco objetivo (~3044 total). Con el prompt ya corregido, el nuevo
volumen debería acercarse al ~42% real, diluyendo la proporción actual del
62.8% hasta que las 172 señaladas representen solo ~5.7% del banco final --
proporción razonable, no justifica descartar contenido pedagógicamente válido
solo por ser potencialmente adivinable en el peor caso.
