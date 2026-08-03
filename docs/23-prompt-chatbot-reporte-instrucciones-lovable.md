# Prompt para Lovable — Chatbot + reporte de problemas + instrucciones/tutorial

> Pega esto en el chat de Lovable. Backend ya desplegado y probado (`faq_chatbot`,
> `report_question_issue`). Contenido inspirado en buenas prácticas vistas en un
> competidor (Moodle de Pablo Lledó), pero redactado desde cero para nosotros — no es
> texto copiado de nadie.

## 1. Widget de chatbot flotante

Botón flotante (esquina inferior derecha, icono de chat) visible en `/dashboard`,
`/aprendizaje`, `/practica`, `/examen` y `/faq`. Al abrirse, un panel de chat simple:

```ts
async function sendMessage(message: string, history: {role: "user"|"assistant", content: string}[]) {
  const { data, error } = await supabase.functions.invoke("faq_chatbot", {
    method: "POST",
    body: { message, history },
  });
  return data?.reply ?? "Lo siento, no pude procesar tu pregunta. Contacta con soporte.";
}
```

- Mantén el historial de la conversación en el estado del componente (no hace falta
  persistirlo en base de datos) y pásalo en cada llamada para que el asistente tenga
  contexto conversacional.
- Mensaje de bienvenida al abrir: *"¡Hola! Puedo ayudarte con dudas sobre planes, el
  simulacro, tu cuenta o el diploma. Para dudas de contenido de gestión de proyectos,
  mejor practica en el simulador — ahí tienes explicación y diagnóstico verificados."*
- Mientras espera respuesta, muestra un indicador de "escribiendo..." simple.
- No hace falta streaming de la respuesta para esta primera versión.

## 2. Botón "Reportar problema" en cada pregunta

En `examen.tsx` y en la pantalla de resultado/revisión, añade un icono discreto (ej.
🚩 o un icono de "flag") junto a cada pregunta, que abra un modal pequeño con un
campo de texto ("Cuéntanos qué está mal") y un botón "Enviar reporte":

```ts
async function reportIssue(questionId: string, comment: string, examId?: string) {
  await supabase.functions.invoke("report_question_issue", {
    method: "POST",
    body: { question_id: questionId, comment, exam_id: examId },
  });
}
```

- Tras enviar, muestra un toast de confirmación breve ("Gracias, lo revisaremos") y
  cierra el modal — no bloquees la navegación del examen por esto.
- No muestres el conteo de reportes al candidato, es información solo para el panel
  admin (ya disponible en `v_question_stats.open_reports_count` para uso interno).

## 3. Página "Instrucciones" (nueva, o sección al inicio de `/aprendizaje`)

Contenido (texto ya redactado, no lo parafrasees):

> **Bienvenido a PMTech Simulator**
>
> Aquí vas a practicar con preguntas situacionales en español para preparar tu examen
> PMP®, calibradas al ECO 2026 vigente desde julio de 2026.
>
> **Plan de estudio recomendado:**
> 1. Lee la Guía del PMBOK® (8ª edición) y la guía práctica ágil de PMI.
> 2. Recorre tu Ruta de Aprendizaje PMTech, lección a lección, practicando cada una.
> 3. Resuelve exámenes por dominio (Personas / Proceso / Entorno de Negocio) para
>    reforzar tus puntos débiles según tu diagnóstico de errores.
> 4. Haz un simulacro completo en condiciones reales (180 preguntas, 240 minutos,
>    3 secciones) para acostumbrarte al formato real del examen.
> 5. Repite práctica dirigida a los tipos de error que más se repiten en tu historial.
> 6. No memorices las respuestas — el objetivo es entrenar tu razonamiento, no
>    reconocer preguntas repetidas.
>
> **Uso del contenido:** las preguntas son para tu uso personal como parte de tu
> licencia. No está permitido compartir, distribuir ni revender el contenido a
> terceros.
>
> **¿Encontraste un problema en una pregunta?** Usa el botón 🚩 junto a la pregunta
> para reportarlo directamente a nuestro equipo de revisión.

## 4. Página "Tutorial de examen" (nueva, o sección junto a Instrucciones)

> **Cómo funciona el simulacro**
> 1. El cronómetro empieza al hacer clic en "Comenzar".
> 2. Puedes revisar y cambiar tus respuestas cuantas veces quieras mientras el examen
>    esté activo.
> 3. Al agotarse el tiempo, el examen se entrega automáticamente.
> 4. Puedes marcar cualquier pregunta "para revisión" sin que eso reste puntos.
> 5. Antes de entregar, verás una pantalla con el resumen de preguntas respondidas,
>    en blanco y marcadas para revisión.
> 6. En preguntas con varias respuestas correctas, debes marcar TODAS las correctas —
>    marcar solo algunas cuenta como fallo, igual que en el examen real de PMI.
> 7. Al entregar, verás tu resultado, qué respondiste bien y mal, y la explicación de
>    cada pregunta.
>
> Ten en cuenta: PMI no publica una nota de corte oficial para el examen real — usa
> bandas de desempeño por dominio, no un porcentaje público. Tu resultado aquí es una
> estimación razonada de tu preparación, no una garantía.

## 5. Explicación de las secciones/descansos antes de empezar un simulacro completo

En la pantalla de configuración de examen, antes de pulsar "Comenzar" en modo
`full_sim`, añade este texto (si no existe ya algo equivalente):

> Este simulacro sigue la estructura real del examen: **Sección 1** con los casos de
> estudio, descanso de 10 minutos, **Sección 2** con la mitad de las preguntas
> independientes, descanso de 10 minutos, **Sección 3** con el resto. Puedes tomar el
> descanso completo o continuar sin él. Una vez cierres una sección, no podrás volver
> a cambiar sus respuestas — igual que en el examen real de PMI.

## Nota sobre el resto de ideas del análisis (CAPM, glosario, etc.)

Este prompt cubre solo lo de alta prioridad / bajo esfuerzo. El resto (filtros de
práctica por enfoque, glosario buscable, licencia de 1 mes, CAPM) se abordará en
lotes de trabajo posteriores.
