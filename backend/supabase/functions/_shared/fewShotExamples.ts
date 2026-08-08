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
