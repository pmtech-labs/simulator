# Spec de extracción — Motor de generación de preguntas (ECO 2026 / PMBOK 8)
### Handoff para el hilo "Simulador de exámenes PMBOK con casos dinámicos"

Fuentes: (A) corpus de 200 preguntas ATP en español (PMBOK 6 / Agile Practice Guide / ECO 2021) — patrones estructurales reutilizables, remapeados al examen vigente desde el 9 jul 2026; (B) corpus de 180 preguntas + 2 case studies **oficiales del PMI, ya construidos sobre ECO 2026/PMBOK 8** — este segundo lote confirma y sustituye buena parte de las hipótesis del primero. Ver secciones 7-10 para los hallazgos del lote B, que tienen prioridad sobre cualquier inferencia del lote A cuando haya conflicto.

**Nota de estado**: el lote B (180 preguntas oficiales) no incluye aún clave de respuestas ni rationale — el usuario hará el examen para obtenerlas y se procesarán como actualización incremental de este documento (sección 10 marca qué queda pendiente de esa capa).

---

## 1. Contexto normativo (verificado, no asumir PMBOK 6)

- **PMBOK 8**: publicación oficial 13 ene 2026. Sustituye la estructura de PMBOK 7.
  - 6 principios (antes 12): Adoptar visión holística, Enfocarse en el valor, Integrar calidad en procesos y entregables, Ser un líder diligente, Integrar sostenibilidad en todas las áreas, Construir cultura de empoderamiento.
  - 7 dominios de desempeño (antes 8): Gobernanza, Alcance, Cronograma, Finanzas, Interesados, Recursos, Riesgo.
  - 40 procesos (antes 49), no prescriptivos, incrustados en los dominios y mapeados a 5 focus areas (IA, sostenibilidad, entrega de valor entre ellos).
  - Filosofía: vuelve el lenguaje de proceso con ITTOs, pero mantiene orientación a valor/resultado. **No es un retorno a PMBOK 6** — el corpus original en lenguaje "proceso nombrado + entrada/salida/herramienta" de PMBOK 6 debe traducirse a lenguaje de dominio/principio, no copiarse literal.

- **ECO 2026**: nueva versión de examen vigente desde 9 jul 2026 (hoy ya está en vigor).
  - Pesos por dominio: **People 33% / Process 41% / Business Environment 26%** (Business Environment triplicó su peso frente al ECO anterior, ~8%).
  - Nuevos focus areas formales derivados del JTA: **IA, sostenibilidad, entrega de valor**.
  - Mezcla predictivo vs. ágil/híbrido: predictivo baja de ~50% a **~40%**; ágil+híbrido combinado sube a **~60%**.
  - Se mantiene la estructura de 3 dominios y el énfasis en juicio situacional (reforzado, no reducido).

- **Formatos de pregunta nuevos** (no presentes en el corpus original):
  - **Scenario chains / case study clusters**: un escenario detallado (puede incluir gráfico de Gantt roto, email de un interesado, calendario de recursos contradictorio) seguido de 4-5 preguntas encadenadas sobre el mismo caso.
  - **Practicum**: preguntas que exigen leer/operar sobre herramientas, datos o gráficos (curvas EV, diagramas de red, dashboards) en vez de solo texto.
  - Drag-and-drop y multi-respuesta ("Escoge dos") se mantienen.

---

## 2. Qué es aprovechable del corpus de 200 preguntas (y qué no)

**Aprovechable tal cual (estructura, no contenido):**
- Formato de enunciado situacional en tercera persona ("Usted es el director del proyecto y..."), con contexto + conflicto + pregunta de acción.
- Taxonomía de distractores (ver sección 3) — es agnóstica a la edición del PMBOK.
- Terminología PMI en español ya validada (ver sección 4), salvo términos ligados a procesos PMBOK 6 específicos.
- Preguntas de cálculo (SPI, CPI, PERT) como plantilla estructural — reutilizar el patrón numérico, pero hay que auditar el corpus antes de reusar los valores (detectamos al menos una inconsistencia en la Q51, y la Q25 está marcada como no válida por el propio ATP; Q148 tiene texto corrupto en la opción A — descartar ambas del set de entrenamiento).

**No aprovechable / requiere reescritura:**
- Cualquier enunciado que cite un proceso específico de PMBOK 6 por nombre ("Realizar el Control de Cronograma", "Planificar la Gestión de Interesados") — en PMBOK 8 esto se resuelve por dominio de desempeño, no por proceso aislado.
- El desbalance temático: el corpus, al ser de 2021, subrepresenta Business Environment (que ahora es 26%, no ~8%) y no cubre IA/sostenibilidad en absoluto.
- El formato: 100% de las 200 preguntas son de opción única/múltiple aislada — ninguna tiene la estructura scenario-chain o practicum.

---

## 3. Taxonomía de distractores (reutilizable sin cambios)

Patrón identificado en las 200 preguntas, válido para cualquier edición porque refleja cómo PMI diseña opciones incorrectas plausibles:

1. **Acción prematura**: la opción incorrecta salta a resolver/escalar antes de reunir información (el patrón dominante en el corpus).
2. **Documento equivocado**: la opción invoca un artefacto real pero no el que gobierna la situación (ej. consultar el registro de riesgos cuando corresponde el plan de gestión de cambios).
3. **Escalación indebida**: escalar a un sponsor/comité cuando el PM tiene autoridad para resolverlo directamente, o al revés, resolverlo unilateralmente cuando el gobierno del proyecto exige escalar.
4. **Correcto pero fuera de secuencia**: la acción es válida pero no es el siguiente paso lógico dado el proceso/dominio.
5. **Enfoque de otra metodología**: en preguntas híbridas, aplicar razonamiento predictivo puro en contexto ágil o viceversa.

**Instrucción para el motor**: al generar distractores, seleccionar 2-3 de estos 5 patrones por pregunta, nunca los 4 restantes al azar — así se mantiene la dificultad calibrada tipo PMI (opciones plausibles, no absurdas).

---

## 4. Banco de vocabulario ES — ajustado a PMBOK 8

**Mantener del corpus** (terminología PMI-ES estable entre ediciones):
Interesado, entregable, línea base, valor ganado (EV), índice de desempeño del cronograma (SPI), índice de desempeño del costo (CPI), estimación a la conclusión (EAC), acta de constitución, registro de riesgos, gestión del cambio, retrospectiva, incremento, backlog, criterios de aceptación, matriz de asignación de responsabilidades (RACI).

**Sustituir / actualizar:**
| Término PMBOK 6 (corpus original) | Término PMBOK 8 |
|---|---|
| Áreas de conocimiento | Dominios de desempeño |
| "Proceso de..." (49 procesos con nombre) | Dominio de [Gobernanza / Alcance / Cronograma / Finanzas / Interesados / Recursos / Riesgo] |
| 12 principios (PMBOK 7) | 6 principios PMBOK 8 (ver sección 1) |
| Triple restricción | Visión holística del valor (principio 1) |

**Vocabulario nuevo a incorporar** (ausente en el corpus, obligatorio por los nuevos focus areas):
IA generativa aplicada a gestión de proyectos, gobernanza de datos de IA, sesgo algorítmico, huella de carbono del proyecto, criterios ESG, economía circular en adquisiciones, entrega continua de valor, flujo de valor (value stream), retorno de valor incremental.

---

## 5. Mapeo de cobertura objetivo (para el generador)

Distribución objetivo por cada 100 preguntas generadas, calibrada a ECO 2026:

- **People — 33**: liderazgo situacional, resolución de conflictos, coaching de equipo, gestión de interesados difíciles, motivación en entornos híbridos/remotos.
- **Process — 41**: planificación integrada, gestión de cronograma/costo (incluye cálculos EVM/PERT), gestión de riesgos, control de cambios, calidad, adquisiciones.
- **Business Environment — 26** *(subrepresentado en el corpus original, priorizar generación aquí)*: cumplimiento regulatorio, alineación estratégica, sostenibilidad/ESG, gobernanza organizacional, IA y su impacto en el entorno de negocio, beneficios y valor de negocio.

Mezcla metodológica: 40% predictivo / 60% ágil-híbrido (frente al corpus original, que es predominantemente predictivo/ágil clásico sin este balance forzado).

Formatos por cada 100 preguntas: incluir al menos 1-2 scenario chains (con 4-5 sub-preguntas cada uno, no contar como pregunta única) y un 10-15% de preguntas tipo practicum con datos/gráficos.

---

## 6. Uso recomendado del corpus original (lote A) en el motor

1. **Few-shot de estructura, no de contenido**: usar 15-20 preguntas del corpus (limpias, sin Q25/Q51/Q148) como ejemplos de *forma* del enunciado situacional y de la taxonomía de distractores — nunca como fuente de hechos PMBOK 6.
2. **Filtro de terminología**: antes de inyectar cualquier pregunta del corpus como few-shot, pasar por el mapeo de la sección 4 para neutralizar términos de proceso PMBOK 6.
3. **Gap de generación pura** (sin apoyo del corpus, generar desde cero con la guía de vocabulario): todo el bloque de Business Environment con foco en IA/sostenibilidad, y los dos formatos nuevos (scenario chains, practicum).

---

## 7. Lote B — corpus oficial PMI (180 preguntas + 2 case studies, ECO 2026/PMBOK 8 real)

Este lote es la fuente de verdad para forma y tono del examen real. Sustituye las hipótesis de la sección 1 sobre formatos y confirma/ajusta el peso de sostenibilidad. Inventario: 133 opción única, 23 respuesta múltiple, 10 ligadas a los 2 case studies (5 preguntas por caso), 9 practicum (gráficos/dashboards), 5 dropdown/matching.

### 7.1 Los dos case studies (texto íntegro disponible, no requiere OCR)

- **Caso 1 — Transformación Empresarial y Alineación Estratégica**: PM asignado tras aprobación del acta en una transformación multinacional. Arco narrativo en 5 beats que corresponden a las 5 preguntas ligadas (Q56-60 en este export): (1) desacuerdo inicial sobre qué significa "éxito" entre patrocinadores — unos priorizan velocidad/costo, otros experiencia de cliente y sostenibilidad del cambio; (2) interesados nuevos con niveles de compromiso desiguales; (3) presión por mostrar avances rápidos vs. necesidad de gobernanza/secuenciación entre funciones y regiones; (4) solicitudes de cambio que arriesgan desviar el valor hacia optimizaciones locales; (5) cierre — duda sobre si las mejoras y lecciones se institucionalizarán o la organización "revertirá" a las formas antiguas de trabajar.
- **Caso 2 — Entrega de Producto Digital Bajo Presión del Mercado**: PM asignado tras aprobación de financiación inicial. Arco en 5 beats (Q116-120 en este export): (1) tensión adaptabilidad vs. estructura/cumplimiento regulatorio (privacidad de datos); (2) coordinación difícil entre equipos con distinta madurez ágil; (3) liderazgo pide visibilidad basada en datos tras movimiento de un competidor — estimaciones inciertas, se discute usar analítica avanzada pero la decisión final es del equipo humano; (4) impedimentos críticos cerca del lanzamiento (integración, desempeño) que exigen repriorizar; (5) cierre — lanzamiento incremental, interpretación de datos de uso real, mantener foco en valor a largo plazo y no solo en visibilidad de corto plazo.

**Mecánica confirmada del cluster**: cada pregunta del bloque de 5 NO repite el texto del caso — solo referencia "el caso práctico" y añade un dato incremental nuevo (una cifra, un email, un hallazgo). El generador debe replicar esta progresión narrativa (tensión inicial → interesados/coordinación → presión de datos/mercado → crisis operativa → cierre/institucionalización), no generar 5 preguntas independientes sobre el mismo texto estático.

### 7.2 Taxonomía de distractores — confirmada y refinada a escala (180 preguntas)

El patrón de la sección 3 se confirma, pero a esta escala aparece un patrón dominante más específico, presente en la gran mayoría de las preguntas de opción única:

- **(Casi siempre correcta)** Analizar/entender primero, con visión holística u orientada a causa raíz, antes de actuar — con frecuencia explícitamente mencionando reevaluar, analizar impacto, o trabajar junto con el interesado relevante para comprender el problema (Q143-D, Q145-D, Q156-A, Q160-C/D, Q172-D, Q173-C, Q174-C, Q176-A/C, Q179-B, Q180-A).
- **Distractor "extremo/reactivo"**: cancelar, eliminar, reemplazar personas, o tomar la acción más drástica sin análisis previo (Q145-A/C, Q150-A, Q162-B, Q179-D).
- **Distractor "status quo/pasivo"**: seguir igual porque una métrica parcial luce bien, ignorando la señal de alerta (Q141-B, Q154-B, Q179-A).
- **Distractor "proceso equivocado o desproporcionado"**: escalar cuando no corresponde, o formalizar en exceso (cambio formal, comité) para algo que se gestiona a nivel de proyecto (Q178-A/C).
- **Distractor "delegar sin supervisión"**: dejar que un tercero (proveedor, IA, un solo miembro del equipo) decida sin validación humana — patrón nuevo, ligado al focus area de IA (Q148: la opción "correcta" nunca es adoptar el ML sin más, exige análisis conjunto con el equipo o validación FODA).

**Implicación para el generador**: la opción correcta en preguntas de opción única del ECO 2026 tiende a tener forma de verbo compuesto — "analizar y ajustar", "revisar y determinar", "evaluar y comunicar" — casi nunca es una acción única y drástica. Es una plantilla generable: [analizar/evaluar/revisar] + [el dato/impacto/causa] + [con el interesado correcto] + [antes de actuar].

### 7.3 Multi-select — dos subtipos confirmados con lógica distinta

- **"Seleccione N opciones"** (N=2 o N=3, cerrado): Q151, Q152, Q161, Q164, Q165, Q167, Q170. Aquí los distractores plausibles superan a N — el generador debe crear 5 opciones totales donde 2-3 más son plausibles pero subóptimas (ninguna es absurda), y las N correctas suelen combinarse por complementariedad (ej. Q161: negociar + analizar impacto + justificar el plazo original — combinan "analizar" con "comunicar", nunca dos acciones redundantes).
- **"Seleccione todas las opciones que correspondan"** (abierto, número variable): Q176, Q177. Aquí el número de correctas no está dado — el generador debe calibrar entre 3 y 4 correctas de 5 opciones, con las incorrectas siendo las que violan el principio de holismo (ignorar datos, restringir comunicación, actuar unilateralmente).

### 7.4 Dropdown/matching — formato confirmado

Q13, Q75, Q132, Q146: emparejar una lista de 4 términos con 4 definiciones (no siempre en el mismo orden). Q146 es el ejemplo más representativo del nuevo focus area: empareja las 4 dimensiones de sostenibilidad (Económica, Gobernanza, Social, Medioambiental) con su enfoque en la toma de decisiones — plantilla directamente reutilizable para generar variantes (ej. emparejar principios PMBOK 8 con su descripción, o dominios de desempeño con su objetivo).

### 7.5 Practicum (preguntas de gráficos) — patrón confirmado

Los 9 casos usan un dashboard o tabla real (curva de defectos + Gantt, change log con semáforos rojo/ámbar/verde, panel de riesgos, backlog con value scoring, resumen financiero) seguido de una pregunta de acción. El patrón de las 4 opciones es casi idéntico en todos los casos: (A) visión equilibrada/holística sopesando corto y largo plazo → normalmente correcta; (B) reacción extrema (eliminar una variable, ej. sostenibilidad); (C) no hacer nada / mantener el rumbo; (D) escalar o pausar innecesariamente. Confirma el patrón anticipado en la muestra piloto — es explotable como plantilla parametrizada: generar un dashboard con una métrica que mejora y otra que empeora simultáneamente (a menudo sostenibilidad vs. velocidad/costo), y forzar al candidato a resolver la tensión con una respuesta compuesta ("analizar tendencia X y ajustar prioridades en Y"), no con una acción unilateral.

### 7.6 Peso real de sostenibilidad — confirmado, más alto de lo estimado en el spec original

De las 180 preguntas, la sostenibilidad aparece como tema central o secundario en al menos 15-20 (dashboards Q141/Q154, dropdown Q146, distractores en Q142/Q145/Q149, EVM/negocio en varias más). No es un tema aislado dentro de Business Environment — aparece cruzado con Process (calidad, cambios) y con People (motivación de equipo en Q149/Q157). **Recomendación**: en el generador, tratar sostenibilidad como dimensión transversal inyectable en cualquier dominio, no como bucket temático separado.

### 7.7 Temas nuevos confirmados, ausentes del corpus v6 (lote A)

- Gobernanza de decisiones con IA/ML: validar output de IA con juicio humano, nunca adoptar sin supervisión (Q148).
- Institucionalización de lecciones aprendidas más allá del proyecto (Q177) — encaja con el principio "construir cultura de empoderamiento" y el dominio de Gobernanza.
- Juicio sobre umbral de escalación (Q178) — cuándo NO escalar aunque haya presión de interesados sénior.
- Integridad y limitaciones de los datos de reporte (Q176) — transparencia de datos como parte de Business Environment.
- Adaptación de comunicación a audiencias divergentes sin perder coherencia (Q180) — matiz nuevo frente al enfoque más binario "escalar sí/no" del corpus v6.
- Realización de beneficios post-entrega, no solo cumplimiento de cronograma (Q179) — value realization como concepto explícito, coherente con el principio "enfocarse en el valor".
- Cálculo EVM confirmado en formato texto simple (Q175: PV/AC/EV/presupuesto → clasificar estado) — mismo patrón que el corpus v6, sigue vigente, sin necesidad de gráfico.

---

## 8. Mapeo de cobertura — actualizado con datos reales del lote B

La distribución objetivo de la sección 5 (People 33 / Process 41 / Business Environment 26, mezcla 40/60 predictivo-ágil) se mantiene como objetivo cuantitativo del ECO. El lote B confirma cualitativamente que dentro de esa distribución:

- Sostenibilidad debe tratarse transversal (sección 7.6), no como sub-bucket aislado de Business Environment.
- IA debe aparecer principalmente como pregunta de **gobernanza de la decisión** (¿confío en el output de la IA sin más, o lo valido?), no como pregunta de "qué es la IA".
- Al menos 1 de cada 9-10 preguntas debería ser tipo practicum (dashboard/gráfico) — proporción observada en el lote real (9/180 = 5%, pero concentradas en Process/Business Environment).
- Al menos 1 de cada 15 preguntas debería ser dropdown/matching (5/180 ≈ 3%).
- Multi-select ronda el 13% del total (23/180) — mantener los dos subtipos de la sección 7.3 en esa proporción aprox. 60/40 (cerrado N vs. abierto "todas las que correspondan").
- Case study clusters: 2 casos de 5 preguntas cada uno en un examen de 180 (10/180 ≈ 5.5%) — razonable como mínimo por examen completo generado.

---

## 9. Uso recomendado del lote B en el motor

1. **Few-shot de forma y de tono, con más peso que el lote A**: estas 180 preguntas sí están ya en el registro/terminología correcta (PMBOK 8 implícito, ECO 2026). Usar directamente como few-shot de estilo sin necesidad de filtro de terminología.
2. **Plantillas parametrizables de alto valor**: la fórmula de distractores de la sección 7.2, el patrón de practicum de la sección 7.5, y el patrón de dropdown de sostenibilidad (7.4) son extraíbles como templates casi mecánicos — priorizar su implementación en el generador antes que la generación libre.
3. **Los 2 case studies son reutilizables como plantilla narrativa completa**: arco de 5 beats (tensión inicial de valor → interesados desiguales → presión externa/datos → crisis operativa → cierre/institucionalización o realización de beneficios) — generar nuevos case studies siguiendo esta misma estructura de 5 beats, cambiando la industria/contexto.

---

## 10. Pendiente — capa de refinamiento con clave de respuestas

El usuario completará el examen para obtener respuesta correcta + rationale oficial del PMI (mismo patrón que el lote A). Cuando esté disponible, actualizar:

- Confirmar o corregir la hipótesis de la sección 7.2 (¿la opción "analizar/evaluar antes de actuar" es sistemáticamente la correcta, o hay excepciones?).
- Añadir rationale oficial como capa de explicación en el banco de preguntas generadas (mejora la calidad pedagógica del simulador, no solo la generación).
- Verificar el reparto real de respuestas correctas en multi-select abierto (Q176/Q177) — cuántas opciones son correctas en la práctica.
