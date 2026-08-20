// Ejemplos de ESTILO curados manualmente de 2 fuentes:
//
// LOTE A: corpus de 200 preguntas ATP en español (PMBOK 6/ECO 2021), remapeado --
// requiere el filtro de terminología descrito abajo, porque cita procesos PMBOK 6
// por nombre en el original.
//
// LOTE B: corpus de 180 preguntas + 2 case studies OFICIALES del PMI, ya
// construidos sobre ECO 2026/PMBOK 8 real (no remapeado) -- terminología ya
// correcta, sin necesidad de filtro. Por indicación explícita del spec de
// extracción (§9.1: "usar directamente como few-shot de estilo... con más peso
// que el lote A"), el lote B se muestrea con el DOBLE de probabilidad relativa
// (cada ejemplo se incluye 2 veces en el pool de origen antes de barajar).
//
// Ninguno de los dos lotes incluye la clave de respuesta marcada en estos
// ejemplos de estilo -- nunca se usan como fuente de verdad de PMBOK, solo de
// tono y construcción del enunciado.
//
// Filtrado aplicado al LOTE A antes de incluir cualquier pregunta:
// - Excluidas Q25, Q51, Q148 (marcadas como inválidas/inconsistentes/corruptas por la
//   propia spec de extracción del PO).
// - Excluidas Q114 y Q169: en su momento se excluyeron por citar "Realizar el Control
//   Integrado de Cambios", asumiendo que era terminología PMBOK 6 prohibida -- el spec de
//   extracción actualizado (ago 2026) confirmó con la clave de respuestas real que esa frase
//   SÍ es vocabulario vivo del examen 2026 (14 apariciones en las 180 preguntas oficiales), así
//   que esta exclusión ya no aplicaría hoy. Se mantienen fuera del pool por prudencia (no se ha
//   vuelto a revisar su calidad completa más allá de este punto terminológico), no por el motivo
//   original.
// - Excluidas preguntas con residuos de limpieza deficiente (frases en inglés pegadas,
//   cabeceras de tabla sin traducir).
// - Excluidas también preguntas con "activos de los procesos organizativos" (término de
//   ITTO de PMBOK 6 que, aunque no estaba en la lista explícita de prohibidos, se evita
//   por prudencia) y duplicados casi idénticos del propio corpus (el banco ATP repite la
//   misma pregunta reformulada varias veces -- se eligió una sola variante de cada una).
//
// LOTE B (Qxxx se refiere a la numeración del corpus oficial de 180 preguntas):
// seleccionadas Q1, Q48, Q114, Q135, Q148, Q154, Q161, Q176, Q178, Q179, Q180 --
// diversidad estructural real: mc_single, mc_multi N=2, mc_multi N=3 (Q161,
// formato nuevo no soportado aún por nuestro generador de mc_multi -- ver nota
// en admin_generation_jobs), mc_multi abierto "todas las que correspondan"
// (Q176), practicum con tabla real (registro de riesgos Q48, panel de cambios
// con semáforos Q154), gobernanza de IA (Q148, el ejemplo que motivó el
// error_type "unsupervised_delegation"), umbral de escalación (Q178).
//
// Separadas en 3 categorías: GENERAL_STYLE_EXAMPLES (situacional A-D/A-E,
// sirve para admin_generation_jobs, admin_generate_case_cluster y de forma
// parcial admin_generate_hotspot_question), MATCHING_STYLE_EXAMPLES (array,
// exclusivo de admin_generate_matching_question), y CASE_CLUSTER_REFERENCE
// (escenario + 5 preguntas reales del Caso 1 oficial del PMI, ejemplo completo
// de la mecánica de cluster para admin_generate_case_cluster).

const LOTE_A_STYLE_EXAMPLES: string[] = [
  `Ejemplo de estilo (situacional, predictivo):
"A los miembros del equipo del proyecto les preocupa que un nuevo recurso no parezca adecuado para una tarea asignada. ¿Cómo debería responder el director del proyecto a esta preocupación?"
A. Comuníquese con la alta gerencia para discutir la posibilidad de reasignar el nuevo recurso a un proyecto diferente.
B. Programe tiempo para conversar con el nuevo recurso para evaluar sus habilidades y comprender su nivel de conocimiento.
C. Pida a los miembros del equipo que documenten las deficiencias relacionadas con la tarea que muestra el recurso.
D. Comuníquese con el patrocinador del proyecto para resaltar estas inquietudes y decidir la respuesta adecuada.`,

  `Ejemplo de estilo (multi-respuesta, "escoge dos"):
"Se pide a un miembro clave del equipo que se traslade a otro proyecto durante la mitad de un proyecto técnico. El equipo cree que es un movimiento imprudente y expresa preocupación. ¿Qué dos acciones ayudarán a resolver el problema? (Escoge dos.)"
A. Discuta el conflicto con el patrocinador del proyecto y formule una respuesta.
B. Utilizar herramientas y técnicas de coaching para motivar al equipo del proyecto.
C. Reemplazar al miembro clave del equipo con un nuevo recurso que tenga las mismas habilidades.
D. Reúnase con la junta de control de cambios (CCB) para discutir el cambio solicitado.
E. Participar en el proceso de gestión de cambios para resolver el problema de los recursos.`,

  `Ejemplo de estilo (ágil, priorización por valor):
"Un gerente de proyecto debe asegurarse de que el equipo ofrezca valor comercial dentro de los plazos requeridos. El gerente se enteró recientemente de que las partes interesadas clave están preocupadas de que el plan de lanzamiento actual no satisfaga las necesidades comerciales urgentes. ¿Qué puede hacer el director del proyecto para responder eficazmente a las inquietudes de las partes interesadas?"
A. Renegociar el alcance con el patrocinador del proyecto después de examinar la estructura de desglose del trabajo (WBS).
B. En consulta con las partes interesadas y los miembros del equipo, identifique el producto mínimo viable necesario para el lanzamiento.
C. Determine el índice de desempeño del cronograma (SPI) y luego eleve el riesgo del cronograma al patrocinador del proyecto.
D. Monitorear el progreso usando un gráfico de evolución después de modificar la línea base del cronograma para cumplir con los requisitos de las partes interesadas.`,

  `Ejemplo de estilo (identificación de conocimiento, muestreo):
"Un proyecto se encuentra en fase de ejecución. Sobre la base del modelo aprobado originalmente, se desarrollaron 1000 productos. El equipo del proyecto elige al azar 100 productos para evaluarlos con el plan de calidad. ¿Qué está llevando a cabo el equipo del proyecto?"
A. Controlar las adquisiciones
B. Muestreo estadístico
C. Auditoría de procesos
D. Aseguramiento de calidad`,

  `Ejemplo de estilo (identificación de conocimiento, respuesta a riesgos):
"Se está planificando un proyecto en una zona remota con acceso limitado a vehículos y equipos. El director del proyecto propone que la empresa entregue todo el equipo pesado por sí misma a pesar de los importantes gastos. El director del proyecto asumirá la plena responsabilidad de esta actividad. ¿Qué tipo de respuesta al riesgo está demostrando el director del proyecto?"
A. Transferir
B. Mitigar
C. Aceptar
D. Evitar`,

  `Ejemplo de estilo (identificación de conocimiento, técnica de estimación):
"El director del proyecto ha verificado que se han definido los paquetes de trabajo de los componentes y se han identificado las limitaciones para cada componente. ¿Qué técnica de estimación debería utilizar el director del proyecto para obtener una estimación de costes precisa del proyecto?"
A. Análoga
B. Tres puntos
C. De abajo hacia arriba
D. Paramétrica`,

  `Ejemplo de estilo (identificación de conocimiento, modelo de desarrollo de equipo):
"Un gerente de proyecto se une a un proyecto como reemplazo en un equipo de proyecto. Durante las reuniones iniciales, hay muchas opiniones diferentes sobre cómo abordar las decisiones técnicas y el entorno se está volviendo contraproducente. Sin embargo, el equipo desarrolló procesos y procedimientos y ahora está trabajando de manera fluida y productiva, sin conflictos ni interrupciones. ¿En qué fase de desarrollo se encuentra el equipo?"
A. Storming
B. Norming
C. Forming
D. Performing`,

  `Ejemplo de estilo (ágil, plan de interesados):
"El jefe de Proyecto aplica un enfoque ágil para una entrega ajustada en el calendario. Necesita revisar el plan de gestión de interesados para que siga los principios ágiles. ¿Qué debería hacer para conseguirlo?"
A. Diseñar un sistema de comunicación digital que permita enviar, revisar y escalar issues de forma virtual.
B. Eliminar capas innecesarias de gestión para promover comunicación directa entre el equipo de proyecto y los interesados.
C. Modificar las plantillas para incluir el burndown y la progresión en el avance del backlog, y promover el uso de stand ups.
D. Incrementar el número de talleres formales de trabajo para cubrir todas las cuestiones de todos los interesados, incluídos los clientes y el sponsor.`,

  `Ejemplo de estilo (ágil, dependencia entre equipos):
"Durante una iteración ágil, la Tarea 1 no se puede completar a tiempo debido a desafíos inesperados. Otro equipo dentro del proyecto depende de la finalización oportuna de la Tarea 1 para cumplir con su parte del proyecto. ¿Cómo debería resolver este problema el director del proyecto?"
A. Reúnase con ambos equipos por separado y pídales que encuentren una manera de cumplir con los plazos requeridos y completar el proyecto a tiempo.
B. Reúnase con el propietario del producto para volver a priorizar el backlog de la iteración, de modo que no afecte a otros equipos u obligaciones.
C. Aumentar el número de miembros del equipo para el equipo del proyecto y aumentar la duración de la iteración, asegurando que el trabajo se completará de acuerdo con el cronograma.
D. Informe a los miembros del equipo que desea que hagan lo mejor posible en circunstancias difíciles y asegúrese de tener en cuenta los desafíos de la iteración en las lecciones aprendidas.`,

  `Ejemplo de estilo (identificación de documento, análisis de riesgo inicial):
"Se le ha pedido a un gerente de proyecto que lleve a cabo un análisis de riesgo que se base en un alcance de alto nivel. Como parte del análisis, el director del proyecto debe utilizar el juicio de expertos para preparar un documento. ¿Qué acción basada en documentos se está realizando?"
A. Creación de la carta del proyecto
B. Preparación del documento de declaración del alcance
C. Creación de un plan de gestión de proyecto
D. Documentar el plan de gestión de riesgos`,

  `Ejemplo de estilo (interpretación de valor ganado, cálculo):
"Un proyecto tiene las siguientes características: Presupuesto de 3 millones; Coste planificado de 630.000; Coste real de 650.000; Valor devengado de 540.000. ¿Qué afirmación es verdadera sobre el estado actual del proyecto?"
A. El proyecto está adelantado a lo programado y por debajo del presupuesto.
B. El proyecto está retrasado y sobrepasado el presupuesto.
C. El proyecto está adelantado al cronograma y por encima del presupuesto.
D. El proyecto está retrasado y por debajo del presupuesto.`,

  `Ejemplo de estilo (priorización de riesgos, tabla probabilidad/impacto):
"El equipo del proyecto identifica cuatro riesgos y evalúa tanto la probabilidad de ocurrencia como el impacto (escala 1-5): Riesgo A (prob. 1, impacto 5), Riesgo B (prob. 4, impacto 4), Riesgo C (prob. 2, impacto 5), Riesgo D (prob. 2, impacto 2). ¿En qué orden debería clasificar el director del proyecto estos riesgos para fines de gestión?"
A. B, A, D, C
B. B, C, A, D
C. B, A, C, D
D. C, D, A, B`,

  `Ejemplo de estilo (respuesta a riesgos, opciones de dos pasos):
"En un proyecto, se identifican tres riesgos críticos con alto impacto. Se requieren tres recursos específicos para abordarlos, pero ya están comprometidos con otro proyecto con entregables críticos. ¿Qué acción debería tomar el director del proyecto?"
A. 1. Consulte con el gerente funcional sobre la disponibilidad de los recursos. 2. Negociar el bloqueo o la reprogramación de tareas con el gerente funcional.
B. 1. Contratar recursos externos. 2. Asigne estos recursos para manejar las tareas.
C. 1. Asume los riesgos. 2. Controle estos riesgos a menudo para reducir el impacto potencial.
D. 1. Genere una reserva para contingencias para solucionar el posible retraso del cronograma. 2. Mitigar el posible impacto.`,

  `Ejemplo de estilo (identificación de conocimiento, tipo de contrato):
"El director del proyecto está preocupado por el riesgo de coste de utilizar un nuevo proveedor en esta etapa del proyecto. Ahora debe trabajar con el equipo de adquisiciones para establecer las especificaciones y el tipo de contrato que se utilizará. ¿Qué debe hacerse?"
A. Recomendar un contrato de tarifa de incentivo de precio fijo (FPIF).
B. Recomendar un contrato de tiempo y material (TM).
C. Recomendar un contrato de coste reembolsable más tarifa de incentivo (CPIF).
D. Recomendar un contrato de precio fijo firme (FFP).`,

  `Ejemplo de estilo (estimación de tres puntos, cálculo):
"Un director de proyecto no está seguro de la duración de un nuevo producto y consulta a varios grupos de expertos en la materia. El primer grupo advierte que el desarrollo se puede terminar en 29 días. El segundo grupo identifica algunos riesgos que podrían hacer que la duración sea de hasta 46 días. El tercer grupo propone un nuevo método de desarrollo que puede acortar el tiempo a 18 días. ¿Cuál es la duración estimada del desarrollo del nuevo producto?"
A. 28
B. 30
C. 32
D. 36`,

  `Ejemplo de estilo (secuencia tras un cierre exitoso):
"Un director de proyecto ha completado los siguientes pasos: terminó un proyecto de implementación de TI, confirmó con el administrador de versiones que todos los sistemas están funcionando, confirmó que la funcionalidad ha sido verificada por el equipo de aseguramiento de la calidad, e informó al cliente. ¿Cuál es el siguiente paso que debe dar el director del proyecto?"
A. Agregar las lecciones aprendidas a la base de conocimientos de la organización.
B. Actualizar el registro de riesgos, las partes interesadas y los miembros del equipo.
C. Asegurarse de que el plan de adquisiciones esté cerrado.
D. Revise, verifique y complete la documentación de publicación.`,

  `Ejemplo de estilo (identificación de conocimiento, técnica de mejores prácticas):
"Una empresa tiene el objetivo de aumentar la satisfacción del cliente en 4 meses. El director del proyecto debe identificar las mejores prácticas de la industria. ¿Qué debería utilizar el director del proyecto para lograr esto?"
A. Evaluación comparativa
B. Grupos de discusión
C. Facilitación
D. Diagrama de afinidad`,

  `Ejemplo de estilo (identificación de conocimiento, coste de la calidad):
"Se lanza un nuevo producto. Cuando un cliente identifica problemas de rendimiento con este producto, el director del proyecto se da cuenta de que el coste de la calidad (COQ) debería haberse utilizado para estimar este coste. ¿Qué categoría de COQ debería haber utilizado el director del proyecto?"
A. Costes de prevención
B. Costes de fallas externas
C. Costes de tasación
D. Análisis de coste-beneficio`,

  `Ejemplo de estilo (identificación de conocimiento, relación entre actividades):
"Un proyecto de desarrollo de nuevos productos tiene tres tareas principales. La tarea A debe entregarse 4 semanas antes de que comience la tarea C. Una vez finalizada la tarea B, se iniciará la tarea C. ¿Cuál es la relación entre las tareas A y B?"
A. Fin al comienzo (FS)
B. De fin a fin (FF)
C. De inicio a inicio (SS)
D. De principio a fin (SF)`,

  `Ejemplo de estilo (selección de ciclo de vida, opción compuesta):
"Un proyecto de transformación de TI tiene tres entregables. El entregable 2 tiene hitos estrictamente programados, sin variaciones esperadas en el cronograma. El director del proyecto espera que el entregable 3 tenga requisitos que cambian rápidamente durante el desarrollo. ¿Qué modelo de ciclo de vida se debe utilizar para cumplir con los requisitos del proyecto?"
A. Seleccione un modelo de proyecto completamente ágil, con una historia de usuario común y sprints de tres semanas.
B. Seleccionar un modelo de proyecto en cascada para los entregables, con hitos firmes y procedimientos de control de cambios.
C. Seleccione un modelo de proyecto híbrido, donde el entregable 2 se posiciona como un único sprint ágil integrado en un proyecto en cascada general.
D. Seleccione un modelo de proyecto híbrido, donde el entregable 2 se posiciona como una fase de cascada única integrada en un proyecto ágil general.`,
];

// LOTE B -- corpus oficial PMI, terminología PMBOK 8/ECO 2026 ya correcta, sin
// necesidad de filtro. Numeración Qxxx referencia el corpus de 180 preguntas.
const LOTE_B_STYLE_EXAMPLES: string[] = [
  `Ejemplo de estilo oficial PMI (ágil, acción retrospectiva):
"Un equipo de proyecto olvidó completar una tarea planificada en una iteración. Durante una reunión de coordinación diaria 3 días después, el equipo se dio cuenta de que la tarea no se había completado. Más tarde ese día, el equipo completó la tarea. ¿Qué debería hacer el director del proyecto para evitar esta situación en el futuro?"
A. Analizar el problema durante la retrospectiva.
B. Abordar el problema en la demostración.
C. Analizar el problema en la siguiente planificación de la iteración.
D. Enviar un correo electrónico al equipo.`,

  `Ejemplo de estilo oficial PMI (practicum, tabla real de registro de riesgos):
"Un extracto del registro de riesgos muestra varios riesgos del proyecto identificados, con uno marcado como 'alto impacto' y 'alta probabilidad'. La acción de mitigación sugerida es contratar recursos adicionales para acelerar las tareas relacionadas con este riesgo." [Tabla: ID, Descripción, Probabilidad, Impacto, Estrategia de respuesta, Responsable, Umbral de disparo -- 3 riesgos con distintos niveles] "¿Qué medida debe adoptar el director del proyecto en respuesta a este riesgo identificado?"
A. Aprobar inmediatamente la contratación de recursos adicionales de manera estratégica para mitigar el riesgo y minimizar el impacto potencial.
B. Actualizar la estrategia de respuesta a los riesgos a fin de incluir la planificación de contingencias para acciones de mitigación alternativas.
C. Solicitar un análisis adicional al equipo para determinar si se necesitan recursos adicionales, dadas las restricciones del proyecto.
D. Reasignar a los miembros actuales del equipo para priorizar el riesgo identificado, mientras se posponen las tareas no críticas.`,

  `Ejemplo de estilo oficial PMI (multi-respuesta N=2, incidente técnico):
"Un equipo de integración de TI experimentó una falla importante después de que una empresa de software de terceros implementara un parche de seguridad que provocó que el nuevo software fallara. ¿Qué dos acciones debería tomar el equipo de proyecto a continuación? (Seleccione 2 opciones)"
A. Reunirse con el Scrum Master para determinar si la visión del producto sigue siendo válida.
B. Reunirse con el dueño del producto para actualizar el trabajo pendiente asociado al producto durante la iteración.
C. Realizar un análisis de impacto y consultar el registro de riesgos para la respuesta a los riesgos.
D. Registrar el defecto en el registro de impedimentos y realizar un análisis de causa raíz.
E. Escalar el problema al patrocinador del proyecto.`,

  `Ejemplo de estilo oficial PMI (riesgo legal, acción de análisis conjunto):
"Se espera una nueva ley que afectará la línea de productos de un negocio en los próximos 6 meses. Se está lanzando el siguiente producto y debería completarse en un plazo de 3 meses. Desafortunadamente, el nuevo producto puede no cumplir con los requisitos de la ley propuesta. ¿Cómo debería responder el director del proyecto a este riesgo?"
A. Reunirse con el patrocinador y los interesados clave para analizar el impacto del riesgo e identificar una solución.
B. Revisar el plan de gestión de los riesgos para aceptar el riesgo; luego, continuar con la planificación del proyecto.
C. Solicitar financiamiento para abordar el problema de manera proactiva y luego avanzar con el proyecto.
D. Reunirse con el patrocinador y los interesados clave para advertirles sobre la ley y aconsejarles que cancelen el proyecto hasta que la legislación esté definida.`,

  `Ejemplo de estilo oficial PMI (gobernanza de IA -- origen del error_type "unsupervised_delegation"):
"Un proyecto farmacéutico incluye un equipo ágil de médicos que analizan escaneos de tejido humano de pacientes que participan en ensayos clínicos de medicamentos. El director ejecutivo quiere aprovechar la tecnología de aprendizaje automático (ML), porque se demostró que es más rápida y precisa que el análisis de escaneo realizado por humanos. ¿Cómo debe proceder el dueño del producto en respuesta a la solicitud del director ejecutivo?"
A. Registrar el riesgo en el registro de riesgos y planificar el análisis de una respuesta en la retrospectiva.
B. Trabajar con el equipo para planificar cómo pueden aprovechar el ML según los datos.
C. Facilitar la capacitación en ML para que los miembros del equipo de proyecto demuestren una mentalidad de crecimiento y se preparen para el cambio.
D. Pedir al equipo que realice un análisis FODA que respalde la validación realizada por humanos.`,

  `Ejemplo de estilo oficial PMI (practicum, panel de cambios con semáforos y tensión sostenibilidad/reservas):
"El director del proyecto revisa un registro de cambios y un resumen del impacto de los cambios que abarca los últimos dos períodos de informes. Varios cambios aprobados se relacionan con mejoras de sostenibilidad solicitadas por los interesados. El resumen muestra los impactos acumulativos en el costo, el cronograma y el valor esperado a largo plazo. Individualmente, cada cambio parece manejable, pero en conjunto están comenzando a erosionar las reservas para contingencias y a comprimir la holgura del cronograma." [Tabla: change log de 2 semanas, 8 cambios, con estado de aprobación, impacto en coste/cronograma, valor esperado] "Según el registro de cambios y el resumen de impacto, ¿qué debería hacer el director del proyecto?"
A. Reevaluar los impactos acumulativos de los cambios y recomendar ajustes a los criterios de aprobación en consecuencia.
B. Continuar aprobando los cambios relacionados con la sostenibilidad, ya que cada uno fue justificado y aprobado de manera individual.
C. Rechazar más cambios relacionados con la sostenibilidad para proteger las reservas para contingencias restantes.
D. Implementar los cambios aprobados sin un análisis adicional para mantener la confianza de los interesados.`,

  `Ejemplo de estilo oficial PMI (multi-respuesta N=3, negociación de plazo):
"Un director de proyecto de una empresa de construcción se reúne con los interesados. Todos los interesados están de acuerdo con un plazo de 20 meses para un proyecto. Después de que el trabajo haya comenzado, el director del proyecto se entera de que los interesados desean que el proyecto se complete en un plazo máximo de 16 meses. ¿Qué tres pasos debe seguir el director del proyecto? (Seleccione 3 opciones)"
A. Negociar el plazo y los requisitos actualizados con los interesados.
B. Volver a negociar los contratos y el plazo con los subcontratistas.
C. Analizar el impacto de la solicitud de los interesados.
D. Justificar el plazo de 20 meses.
E. Preguntar al equipo de proyecto si pueden entregar el trabajo en un plazo reducido.`,

  `Ejemplo de estilo oficial PMI (multi-respuesta abierta, integridad de datos de reporte):
"Durante la ejecución, el director del proyecto descubre inconsistencias entre las fuentes de datos usadas para el informe de estado. Algunas métricas son oportunas pero incompletas, mientras que otras son exactas pero se quedan rezagadas en el desempeño real. El equipo de liderazgo espera actualizaciones oportunas para respaldar las decisiones. ¿Qué acciones debe tomar el director del proyecto? (Seleccione todas las opciones que correspondan)"
A. Evaluar la confiabilidad y las limitaciones de cada fuente de datos antes de usarlas en los informes.
B. Usar los datos más actuales disponibles, incluso si no se puede verificar completamente su exactitud.
C. Comunicar las limitaciones y los supuestos de los datos al presentar información sobre el estado.
D. Retrasar todos los informes hasta que las discrepancias de los datos se resuelvan completamente de forma interna.
E. Mejorar los procesos de recopilación de datos para aumentar la exactitud y la puntualidad.`,

  `Ejemplo de estilo oficial PMI (umbral de escalación -- cuándo NO escalar):
"Durante la ejecución, un problema del proyecto se mantiene dentro de las tolerancias de desempeño definidas, pero está llamando más atención de los interesados sénior. Los miembros del equipo sugieren escalar el problema de inmediato para evitar un escrutinio futuro. ¿Qué debería hacer el director del proyecto?"
A. Escalar el problema a la gobernanza de inmediato para demostrar transparencia.
B. Continuar con la gestión del problema a nivel de proyecto mientras se monitorean los umbrales de tolerancia.
C. Solicitar un cambio formal para ampliar las tolerancias de los problemas y reducir la presión del escalamiento.
D. Transferir la propiedad del problema a los interesados sénior para compartir la responsabilidad.`,

  `Ejemplo de estilo oficial PMI (verbo compuesto, tensión cronograma/beneficios):
"Un proyecto entrega resultados según lo planificado, pero los indicadores tempranos muestran que los beneficios comerciales esperados pueden no materializarse completamente. Algunos interesados están conformes con la entrega a tiempo, mientras que otros cuestionan si el proyecto entrega suficiente valor. ¿Qué debería hacer el director del proyecto?"
A. Continuar con la ejecución del proyecto según lo planificado, ya que los entregables se están completando según el cronograma.
B. Reevaluar los beneficios esperados y ajustar las prioridades de entrega para mejorar la materialización del valor.
C. Solicitar un alcance adicional para aumentar la probabilidad de alcanzar los beneficios planificados.
D. Escalar las preocupaciones a los patrocinadores y pausar la entrega hasta que los beneficios estén aclarados por completo.`,

  `Ejemplo de estilo oficial PMI (comunicación a audiencias divergentes):
"Durante la ejecución, las expectativas de los interesados empiezan a divergir. Algunos interesados priorizan las actualizaciones rápidas del progreso, mientras que otros solicitan información más detallada sobre los riesgos y las incertidumbres emergentes. ¿Qué debería hacer el director del proyecto?"
A. Adaptar la comunicación a las necesidades de los interesados, manteniendo al mismo tiempo la transparencia y la coherencia.
B. Proporcionar el mismo nivel de información a todos los interesados para mantener una comprensión uniforme.
C. Limitar la comunicación a actualizaciones de progreso de alto nivel para evitar confusiones innecesarias.
D. Escalar las decisiones de comunicación a los patrocinadores para determinar un enfoque adecuado.`,
];

export const GENERAL_STYLE_EXAMPLES: string[] = [
  ...LOTE_A_STYLE_EXAMPLES,
  ...LOTE_B_STYLE_EXAMPLES,
  ...LOTE_B_STYLE_EXAMPLES, // lote B se muestrea con el doble de peso (spec §9.1)
];

export const MATCHING_STYLE_EXAMPLES: string[] = [
  `Ejemplo de estilo (lote A, emparejamiento término-definición):
"Un miembro del equipo expresa preocupación por un problema de comportamiento del equipo durante una reunión retrospectiva. Empareja cada técnica de resolución de conflictos con la posible resolución del director de proyecto para este problema."
- Retirar / evitar → Tan pronto como sea posible, asigne uno o ambos miembros a un proyecto o iniciativa diferente.
- Suavizar / acomodar → Reconozca los sentimientos de los miembros del equipo con respecto al alto nivel de requisitos.
- Compromiso / reconciliación → Reconsidere la distribución del trabajo entre todo el equipo para asegurarse de que el trabajo se distribuya de manera equitativa.
- Colaborar / resolver problemas → Reúnase con todo el equipo para discutir la asignación de requisitos y la metodología de planificación.`,

  `Ejemplo de estilo oficial PMI (lote B, respuesta a riesgos + propósito):
"Asocie cada respuesta a los riesgos con su propósito principal."
- Aceptar → No tomar medidas inmediatas más allá del monitoreo.
- Evitar → Eliminar la amenaza por completo.
- Mitigar → Reducir la probabilidad o el impacto de un riesgo.
- Transferir → Transferir la propiedad del riesgo a un tercero.`,

  `Ejemplo de estilo oficial PMI (lote B, dimensiones de sostenibilidad -- el ejemplo más representativo del focus area):
"Asocie cada dimensión de sostenibilidad con su enfoque principal en la toma de decisiones del proyecto."
- Económica → Viabilidad financiera a largo plazo y materialización del valor.
- Gobernanza → Supervisión ética, transparencia y responsabilidad.
- Social → Impacto en la comunidad, bienestar de la fuerza laboral y equidad de los interesados.
- Medioambiental → Eficiencia de los recursos, reducción de emisiones e impacto ecológico.`,
];

// Referencia completa de cluster: escenario + sus 5 preguntas reales, Caso 1
// oficial del PMI del lote B ("Transformación Empresarial y Alineación
// Estratégica"). A diferencia de GENERAL_STYLE_EXAMPLES (una pregunta suelta),
// esto muestra la mecánica completa del arco de 5 beats con datos reales --
// complementa (no sustituye) la guía abstracta de CASE_STUDY_BEATS en
// admin_generate_case_cluster: aquí el modelo ve un ejemplo end-to-end de cómo
// cada pregunta añade un dato incremental sin repetir el escenario.
export const CASE_CLUSTER_REFERENCE = `Ejemplo de referencia completo (caso oficial real del PMI, escenario + 5 preguntas):

ESCENARIO: "Una organización multinacional de tamaño mediano lanza una iniciativa de
transformación estratégica para mejorar la colaboración entre funciones y acelerar la
entrega de valor. Se le asigna como director del proyecto tras la aprobación del acta
de constitución. Aunque los patrocinadores están de acuerdo en la necesidad de la
transformación, surgen interpretaciones distintas de qué significa el éxito: algunos
priorizan entrega rápida y eficiencia de costos, otros la experiencia del cliente y la
capacidad organizacional a largo plazo."

PREGUNTA 1 (beat: tensión inicial de valor): "Al comienzo de la iniciativa, el equipo
de liderazgo sénior expresa puntos de vista diferentes sobre cómo se ve el éxito, que
van desde una entrega más rápida hasta una mejor experiencia del cliente. ¿Qué debería
hacer el director del proyecto?" → correcta: facilitar un debate estructurado con los
interesados clave para alinearse en resultados y valor como grupo (nunca: documentar
unilateralmente, o comunicar sin antes alinear).

PREGUNTA 2 (beat: interesados desiguales, dato incremental: se incorporan nuevos
interesados): "A medida que se involucran más interesados, los niveles de
participación varían y algunos siguen sin creer en los beneficios. ¿Qué debería
hacer el director del proyecto?" → correcta: analizar las necesidades e influencia de
los interesados y adaptar los enfoques de involucramiento (nunca: escalar de
inmediato, ni enfocarse solo en quienes ya colaboran).

PREGUNTA 3 (beat: presión externa, dato incremental: presión de mostrar avances):
"Durante la planificación, el liderazgo presiona para ejecutar rápido y demostrar
progreso visible, mientras las interdependencias entre funciones crean desafíos de
coordinación. ¿Qué debería hacer el director del proyecto?" → correcta: evaluar la
complejidad e interdependencias primero, y luego determinar el enfoque de entrega
(nunca: acelerar sin análisis, ni completar todo el detalle antes de decidir nada).

PREGUNTA 4 (beat: crisis operativa, dato incremental: solicitudes de cambio en
conflicto): "Surgen solicitudes de cambio -- algunas apoyan la intención original,
otras arriesgan desviar el enfoque hacia optimizaciones locales. ¿Qué debería hacer
el director del proyecto?" → correcta: evaluar los cambios propuestos a través del
proceso de control de cambios, valorando alineación, valor y gobernanza (nunca:
aprobar todo lo urgente, ni aplazar todas las decisiones).

PREGUNTA 5 (beat: cierre/institucionalización, dato incremental: se acerca el cierre
formal): "El proyecto se acerca al cierre formal y las responsabilidades se
transferirán a la organización, pero persiste la duda de si las mejoras se
mantendrán en el tiempo. ¿Qué debería hacer el director del proyecto?" → correcta:
facilitar la transición de la propiedad a operaciones, asegurando que las
responsabilidades en curso queden definidas y acordadas con claridad (nunca: cerrar
solo verificando entregables formales, ni limitarse a validar cifras financieras).

Nota de mecánica: cada pregunta reference brevemente la situación ya planteada y
añade UN dato incremental nuevo -- ninguna repite el texto completo del escenario.`;

/** Devuelve `count` ejemplos generales al azar (sin repetir) para inyectar en el prompt
 * de generación situacional (admin_generation_jobs, admin_generate_case_cluster) o de
 * escenario (admin_generate_hotspot_question, con count=1 para no sobrecargar el prompt
 * con distractores A-D que no aplican a ese formato). */
export function pickStyleExamples(count = 2): string {
  const shuffled = [...GENERAL_STYLE_EXAMPLES].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);
  return `\n\nESTILO DE REFERENCIA (solo tono y construcción del enunciado -- NUNCA copies hechos, datos ni terminología PMBOK 6 de aquí, son ejemplos antiguos que ya no aplican; usa tu propio contenido siguiendo únicamente ESTE estilo narrativo):\n${picked.join("\n\n")}`;
}

/** Referencia de estilo dedicada para admin_generate_matching_question -- el único
 * generador que produce pares término-definición, no preguntas situacionales con
 * distractores A-D, así que los ejemplos generales no le sirven de nada. */
export function matchingStyleReference(): string {
  const picked = MATCHING_STYLE_EXAMPLES[Math.floor(Math.random() * MATCHING_STYLE_EXAMPLES.length)];
  return `\n\nESTILO DE REFERENCIA (solo tono y construcción de los pares -- NUNCA copies hechos ni terminología PMBOK 6 de aquí, es un ejemplo antiguo que ya no aplica; usa tu propio contenido siguiendo únicamente ESTE estilo):\n${picked}`;
}

/** Referencia completa de cluster (escenario + 5 preguntas reales) para
 * admin_generate_case_cluster -- complementa la guía abstracta de beats con un
 * ejemplo end-to-end real. */
export function caseClusterReference(): string {
  return `\n\n${CASE_CLUSTER_REFERENCE}`;
}
