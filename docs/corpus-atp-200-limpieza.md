# Limpieza aplicada al corpus ATP de 200 preguntas (compartido por el PO)

## Excluidas del uso como few-shot

| # | Motivo |
|---|---|
| Q25 | El propio corpus la marca "(ESTA PREGUNTA, NO CONTEMPLADA)" |
| Q51 | La spec de extracción original la marca como inconsistente. No se pudo re-verificar de forma independiente porque el volcado no trae clave de respuestas (ninguna pregunta la trae) |
| Q148 | Opción A corrupta: "Construir servicios bibliotecarios. ¿¿¿¿¿¿¿¿¿???????????" |
| Q114 | Cita literalmente el proceso PMBOK 6 "Realizar el Control Integrado de Cambios" en la opción B |
| Q169 | Cita literalmente el mismo proceso PMBOK 6 en las opciones A y C |
| Q15 | Frase en inglés residual pegada al final del enunciado |
| Q172 | Cabeceras de tabla (Risk/Probability/Impact) sin traducir |

## Selección final para few-shot (8 preguntas)

Q2, Q6, Q17, Q38, Q78, Q107, Q141, Q179 -- diversidad estructural (situacional
predictivo/ágil, multi-respuesta "escoge dos", emparejamiento, identificación de
conocimiento puro). Ver `_shared/fewShotExamples.ts` para el texto curado final.

Uso: exclusivamente como referencia de ESTILO/TONO narrativo, nunca como fuente de
hechos PMBOK ni de respuestas correctas (el corpus no trae clave, así que no hay
riesgo de que el modelo "aprenda" una respuesta incorrecta marcada como buena).
