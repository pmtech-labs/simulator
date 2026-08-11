// Ejemplos de ESTILO (no de contenido/hechos) curados manualmente del corpus original
// de 200 preguntas ATP compartido por el PO. Uso exclusivo: mostrarle al modelo el TONO
// y la CONSTRUCCIÓN de un enunciado situacional tipo PMP -- nunca se usan como fuente de
// verdad de PMBOK, ni llevan marcada la respuesta correcta (el corpus original tampoco
// traía clave de respuestas, así que no hay riesgo de que el modelo "aprenda" una
// respuesta incorrecta).
//
// Filtrado aplicado antes de incluir cualquier pregunta aquí:
// - Excluidas Q25, Q51, Q148 (marcadas como inválidas/inconsistentes/corruptas por la
//   propia spec de extracción del PO).
// - Excluidas Q114 y Q169: citan literalmente el proceso PMBOK 6 "Realizar el Control
//   Integrado de Cambios" -- justo el patrón que la nueva regla de terminología (ver
//   buildSystemPrompt) prohíbe. Se prefirió excluirlas antes que editarlas.
// - Excluidas preguntas con residuos de limpieza deficiente (frases en inglés pegadas,
//   cabeceras de tabla sin traducir).
// - Excluidas también preguntas con "activos de los procesos organizativos" (término de
//   ITTO de PMBOK 6 que, aunque no estaba en la lista explícita de prohibidos, se evita
//   por prudencia) y duplicados casi idénticos del propio corpus (el banco ATP repite la
//   misma pregunta reformulada varias veces -- se eligió una sola variante de cada una).
//
// Ampliado de 8 a 23 ejemplos (agosto 2026): el conjunto inicial cubría solo 8-9
// preguntas curadas a mano; se amplió con 15 más para dar más diversidad estructural
// real al muestreo aleatorio de pickStyleExamples() sin aumentar el tamaño de cada
// prompt individual (se sigue muestreando solo 1-2 por llamada).
//
// Separadas en 2 categorías porque no todos los generadores producen el mismo tipo de
// contenido: GENERAL_STYLE_EXAMPLES (situacional con opciones A-D/A-E, sirve para
// admin_generation_jobs, admin_generate_case_cluster y -- de forma parcial, solo para
// el tono del escenario -- admin_generate_hotspot_question) y MATCHING_STYLE_EXAMPLE
// (término-definición, exclusivo de admin_generate_matching_question, cuyo contenido
// no tiene nada que ver con distractores A-D).

export const GENERAL_STYLE_EXAMPLES: string[] = [
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

  `Ejemplo de estilo (identificación de conocimiento, tipo de respuesta al riesgo):
"Se está planificando un proyecto en una zona remota con acceso limitado a vehículos y equipos. El director del proyecto propone que la empresa entregue todo el equipo pesado por sí misma a pesar de los importantes gastos, asumiendo la plena responsabilidad de esta actividad. ¿Qué tipo de respuesta al riesgo está demostrando el director del proyecto?"
A. Transferir
B. Mitigar
C. Aceptar
D. Evitar`,

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

export const MATCHING_STYLE_EXAMPLE = `Ejemplo de estilo (emparejamiento, término-definición):
"Un miembro del equipo expresa preocupación por un problema de comportamiento del equipo durante una reunión retrospectiva. Empareja cada técnica de resolución de conflictos con la posible resolución del director de proyecto para este problema."
- Retirar / evitar → Tan pronto como sea posible, asigne uno o ambos miembros a un proyecto o iniciativa diferente.
- Suavizar / acomodar → Reconozca los sentimientos de los miembros del equipo con respecto al alto nivel de requisitos.
- Compromiso / reconciliación → Reconsidere la distribución del trabajo entre todo el equipo para asegurarse de que el trabajo se distribuya de manera equitativa.
- Colaborar / resolver problemas → Reúnase con todo el equipo para discutir la asignación de requisitos y la metodología de planificación.`;

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
  return `\n\nESTILO DE REFERENCIA (solo tono y construcción de los pares -- NUNCA copies hechos ni terminología PMBOK 6 de aquí, es un ejemplo antiguo que ya no aplica; usa tu propio contenido siguiendo únicamente ESTE estilo):\n${MATCHING_STYLE_EXAMPLE}`;
}
