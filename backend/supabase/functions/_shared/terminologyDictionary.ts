// Diccionario terminológico PMP® en español para el examen 2026 -- compartido
// por el PO (docx original en docs/diccionario-terminologico/), construido
// analizando cruzadamente el PMBOK 8 completo y las 180 preguntas oficiales
// del lote B. 331 entradas totales documentadas; este fichero contiene la
// versión COMPACTA y ACCIONABLE para inyectar en los prompts de generación --
// el documento completo (con la evidencia PMBOK/corpus de cada término) vive
// en docs/diccionario-terminologico/ como referencia de auditoría, no se
// inyecta entero en cada llamada (331 entradas completas serían
// prohibitivamente caras en tokens por generación).
//
// Estructura basada en el propio marco de cierre del diccionario (entrada
// #332, "PMI no tiene una localización 100% unívoca"): 4 categorías con
// tratamiento distinto.

// CATEGORÍA 1 -- términos PMI muy estables: una sola forma, siempre.
// Violar esto es un error de terminología, no una cuestión de estilo.
export const TERMINOS_ESTABLES = `
- Project Manager → "Director del proyecto" (NUNCA "Gerente de proyecto")
- Stakeholder → "Interesado"
- Deliverable → "Entregable"
- Schedule → "Cronograma"
- Risk → "Riesgo"
- Earned Value → "Valor ganado"
- Project Sponsor / Sponsor → "Patrocinador (del proyecto)" (nunca el anglicismo "sponsor")
- Product Owner → "Dueño del producto" (nunca "propietario del producto")
- Scrum Master → "Scrum Master" (no traducir)
- Functional Manager → "Director funcional" / "Gerente funcional" (mismo concepto, no dos roles distintos)
- Project Management Office (PMO) → "Oficina de dirección de proyectos (PMO)" (NUNCA "oficina de gestión de proyectos")
- Project Management → "Dirección de proyectos" (NUNCA "Administración de proyectos")
- Customer → "Cliente"
- End User → "Usuario final" (rol distinto de Cliente, aunque puedan coincidir en una persona)
- Seller / Supplier / Vendor / Contractor → "Proveedor" es la forma predominante en preguntas situacionales; "Contratista" y "Vendedor" son variantes reconocidas, no usar "Suministrador"
- WBS → "WBS" (NUNCA "EDT" en contenido nuevo -- es una de las decisiones terminológicas más importantes del diccionario, EDT solo debe reconocerse como legado, no reproducirse)
- "Adaptativo" (NUNCA "Adaptivo" -- anomalía puntual del banco de examen que NO debe reproducirse en contenido nuevo)
- Crashing → "Intensificación" (nunca "choque"/"colapso"/"aceleración")
- Fast Tracking → "Ejecución rápida" (nunca "seguimiento rápido")
- Float → "Holgura"
- Planned Value → "Valor planificado (PV)"
- Actual Cost → "Costo real (AC)"
- Budget at Completion → "Presupuesto hasta la conclusión (BAC)"
- Cost Variance → "Variación del costo (CV)" -- fórmula CV = EV − AC
- Schedule Variance → "Variación del cronograma (SV)" -- fórmula SV = EV − PV
- Variance at Completion → "Variación a la conclusión (VAC)" -- fórmula VAC = BAC − EAC
- Cost Performance Index → "Índice de desempeño del costo (CPI)"
- Monitoring → "Monitoreo" (NUNCA "Supervisión" como regla general -- supervisión tiene uso propio ligado a oversight/gobernanza)
- Performance → "Desempeño" para dirección y control del proyecto ("Rendimiento" queda solo para usos financieros, de equipo o flujo/productividad)
- Conformance → "Conformidad" / Compliance → "Cumplimiento" (NO son traducciones alternativas de la misma palabra)
- Engagement → "Involucramiento" (concepto global) / Participation → "Participación" (manifestación del involucramiento) / Commitment → "Compromiso" (nivel de implicación) -- NUNCA traducir "Stakeholder Engagement" como "compromiso de los interesados"
- Backlog → "Trabajo pendiente"; Product Backlog → "Trabajo pendiente asociado al producto"; Sprint Backlog → "Trabajo pendiente del sprint"
- Definition of Done (DoD) → "Definición de terminado" / Definition of Ready (DoR) → "Definición de listo" (nunca "definición de hecho/completado")
- Servant Leadership → "Liderazgo de servicio" (NUNCA "líder sirviente" ni "liderazgo servidor")
- Effort → "Esfuerzo" / Duration → "Duración" -- NO son intercambiables (esfuerzo = unidades de trabajo, duración = periodos transcurridos)
- Assumption → "Supuesto" (creencia provisional) / Constraint → "Restricción" (límite real) -- ambos pueden generar riesgo si cambian
- Monte Carlo → "Análisis/simulación de Montecarlo" (una palabra) en redacción propia nueva; "Monte Carlo" (dos palabras) es variante de examen reconocible
- Multipoint Estimating → "Estimación multipunto" en redacción propia; "Estimación por tres valores"/"Estimación ponderada por tres valores" son variantes de examen reconocibles
- Cost → "Costo" (NUNCA "Coste" -- 0 apariciones de "coste" en las 180 preguntas oficiales del examen real)
- Product Owner ≠ Product Manager: "Dueño del producto" y "Gerente del producto" son roles PMI DISTINTOS y reconocidos por separado -- nunca tratarlos como sinónimos ni fusionarlos en una misma pregunta
`.trim();

// CATEGORÍA 2/3 -- variantes legítimas dentro del propio PMI: se elige una
// principal para redactar contenido NUEVO, pero ambas formas son válidas y
// pueden aparecer combinadas en la explicación para reforzar reconocimiento.
export const VARIANTES_RECONOCIDAS = `
- Issue / Issue Log → usar SIEMPRE "Problema" / "Registro de problemas" al generar contenido nuevo -- confirmado con la clave de respuestas real de las 180 preguntas oficiales: 14 apariciones de "Registro de problemas", CERO de "Registro de incidentes", pese a que PMBOK 8 usa "Incidente" 31 veces. "Incidente" es vocabulario de PMBOK, no del examen -- reconocerlo si aparece en la respuesta de un candidato, pero el generador nunca debe producirlo activamente.
- Status Report → "Informe de estatus" e "Informe de estado" son ambas válidas, sin preferencia fuerte
- Mentoring → "Mentoría" como forma principal; "Tutoría" es variante descriptiva PMBOK igualmente válida
- Técnicas de resolución de conflictos: usar "Suavizar/acomodar", "Colaborar/resolver problemas", "Forzar/dirigir", "Comprometer/conciliar", "Retirarse/evitar" (forma de examen, ligeramente distinta de "suavizar/ceder" y "comprometerse/conciliarse" de PMBOK -- mismo concepto)
- Integrated Change Control (proceso/técnica) → el examen 2026 real usa la forma heredada "Realizar el control integrado de cambios" (14 apariciones confirmadas en las 180 preguntas oficiales), aunque PMBOK 8 renombró el proceso a "Evaluar e implementar cambios" con la técnica "control de cambios integrado" -- usar la forma del examen cuando el contexto lo pida. Esto NO es un "proceso PMBOK 6 prohibido": es terminología viva del examen real, distinta del resto de nombres de proceso PMBOK 6 (esos sí siguen prohibidos salvo que el corpus oficial confirme lo contrario, como aquí).
- Project Scope Statement → "Enunciado del alcance del proyecto" como forma principal (PMBOK usa también "declaración del alcance" en algún punto -- mismo documento)
- Project Management Plan → "Plan para la dirección del proyecto" (NUNCA confundir con los planes subsidiarios, que sí usan "Plan DE GESTIÓN de X": plan de gestión del alcance, plan de gestión de los riesgos, etc.)
- Backlog Refinement → "Perfeccionamiento de la lista de trabajo pendiente" como forma principal de examen ("Refinamiento del trabajo pendiente" es variante PMBOK)
- Benefits Realization → el documento formal es "Plan de gestión de beneficios"; "materialización de beneficios" y "realización de beneficios" son variantes válidas en prosa, pero no crear tres artefactos distintos
`.trim();

// CATEGORÍA 4 -- reglas CONCEPTUALES, no solo de vocabulario: cambian el
// razonamiento de la pregunta/explicación, no son intercambiables nunca.
export const REGLAS_CONCEPTUALES = `
- Verification SIEMPRE antes que Validation, SIEMPRE antes que Acceptance: primero se verifica la calidad técnica, después se valida con el interesado/cliente, y solo entonces se obtiene la aceptación formal. Nunca dar por hecho que "verificado" = "aceptado".
- "Puede ocurrir" (incertidumbre futura) → pertenece al Registro de riesgos. "Ha ocurrido / está ocurriendo" (ya es un hecho) → pertenece al Registro de problemas. Esta distinción puede decidir directamente qué opción es correcta.
- Monitoring (observar y evaluar qué ocurre) vs Controlling (decidir y actuar para corregir/mantener alineación) vs Managing (actuar de forma continuada) -- no son sinónimos intercambiables.
- Termination (el hecho/evento que pone fin al proyecto, ej. pérdida de financiación) es distinto de Closure (el procedimiento formal posterior: archivar, cerrar contratos, transferir conocimiento). Un proyecto puede TERMINAR sin haberse CERRADO todavía -- cerrar sigue siendo obligatorio incluso tras una terminación abrupta.
- Cancellation puede activar Closure, pero Cancelar ≠ Cerrar. Todo proyecto cancelado debe seguir cerrándose formalmente (archivar, cerrar contratos, documentar lecciones, liberar recursos).
- El cierre formal EXISTE también en enfoques ágiles/adaptativos (retrospectivas, aceptación de entregables, transferencia de conocimiento) -- nunca asumir que "ágil no tiene cierre".
- Un proyecto no exitoso (perdió financiación, caso de negocio inválido, riesgo intolerable) TAMBIÉN debe cerrarse formalmente -- es una trampa conceptual común en preguntas de cierre.
- Empowerment (crear las condiciones para que decidan), Delegation (transferir autoridad concreta) y Autonomy (margen real de decisión) no son sinónimos -- en escenarios ágiles, "facilitar + empoderar + permitir autonomía" es coherente con PMI; "microgestionar + asignar cada decisión" suele ser una señal de respuesta débil.
- Coaching (ayudar a que la persona DESCUBRA la solución por sí misma) es distinto de Mentoring (compartir experiencia/conocimiento propio directamente) -- elegir el verbo correcto según si la persona ya tiene la capacidad pero no la usa (coaching) o le falta conocimiento/experiencia (mentoring).
- Uncertainty (incertidumbre, concepto amplio) puede ORIGINAR Risk (riesgo, manifestación concreta que afecta objetivos), pero no son lo mismo -- una situación incierta puede resolverse con más información sin llegar nunca a materializarse como riesgo.
`.trim();

// Entrada #250 del diccionario: "La palabra más importante de muchas
// preguntas: PRIMERO" -- patrón de 7 secuencias de decisión extraído
// directamente del análisis de las 180 preguntas oficiales por el PO. Esto
// SUSTITUYE la heurística anterior de "verbo compuesto" (verificada
// estadísticamente como sobreestimada, solo 31-42% de las correctas reales
// la siguen) por un marco mucho más preciso y verificado por el propio PO.
export const PATRON_PRIMERO = `
Muchas preguntas PMP giran en torno a "¿qué debería hacer primero / a continuación?". El
análisis de las 180 preguntas oficiales revela 7 patrones de secuencia recurrentes (NO es un
algoritmo rígido, el contexto de cada escenario manda, pero es una pauta muy sólida):

1. Comprender antes de actuar: identificar → analizar/evaluar → actuar. (Ej. antes de aceptar,
   rechazar o escalar un cambio, evaluar primero su impacto.)
2. Ir a la fuente de autoridad cuando el procedimiento ya existe: revisar/consultar el plan,
   registro, contrato o criterio correspondiente, no improvisar. (Ej. consultar el plan de
   gestión de cambios para determinar la autoridad de aprobación.)
3. Comprender a la persona antes de actuar contra ella: conversar/reevaluar antes de sustituir
   o sancionar. (Ej. antes de reemplazar a alguien, hablar primero con esa persona.)
4. Resolver en el nivel adecuado antes de escalar: gestionar → intentar resolver → monitorear
   umbral → escalar solo si corresponde.
5. Verificar antes de validar/aprobar: verificar calidad → validar con el interesado →
   aprobación/aceptación formal.
6. Alinear antes de formalizar cuando todavía no existe acuerdo: facilitar discusión →
   alineación → documentación/comunicación.
7. Analizar antes de negociar cambios importantes: analizar impacto → negociar condiciones.

Conteos reales confirmados sobre las 180 preguntas oficiales (diccionario terminológico, Bloque 14):
evaluar (57), revisar (65), determinar (46), actualizar (39), analizar (36), identificar (36),
escalar (25), priorizar (19). Regla explícita: el verbo de la opción CORRECTA casi siempre
pertenece a este set (identificar/evaluar/analizar/revisar/consultar/facilitar/determinar) --
NUNCA "escalar", "reemplazar", "cancelar", "rechazar" o "aprobar" como PRIMER verbo de la opción
correcta, salvo que el propio enunciado indique explícitamente que el paso de análisis previo ya
se completó.
`.trim();

/** Bloque compacto para inyectar en los generadores de preguntas
 * (admin_generation_jobs, admin_generate_case_cluster) -- obligatorio, no
 * opcional. Incluye los términos estables + el patrón PRIMERO, que juntos son
 * el núcleo accionable para redactar contenido nuevo correctamente. */
export function terminologiaObligatoria(): string {
  return `\n\nDICCIONARIO TERMINOLÓGICO PMP 2026 (obligatorio, construido cruzando PMBOK 8 completo con las 180
preguntas oficiales del examen real -- fuente de verdad por encima de cualquier otra convención):

TÉRMINOS ESTABLES (usa SIEMPRE esta forma, es un error de terminología no hacerlo):
${TERMINOS_ESTABLES}

REGLAS CONCEPTUALES (no son solo vocabulario, cambian el razonamiento correcto de la pregunta):
${REGLAS_CONCEPTUALES}

${PATRON_PRIMERO}`;
}

/** Versión reducida para generadores con menos presupuesto de contexto
 * (matching, hotspot) -- solo los términos estables, sin el patrón PRIMERO
 * (que aplica sobre todo a preguntas situacionales de opción múltiple). */
export function terminologiaCompacta(): string {
  return `\n\nDICCIONARIO TERMINOLÓGICO PMP 2026 (obligatorio, construido cruzando PMBOK 8 con las 180 preguntas
oficiales del examen real):

${TERMINOS_ESTABLES}`;
}
