# Informe de avance vs roadmap — Simulador PMP (ECO 2026 / PMBOK 8)
### Auditoría funcional previa a pruebas de aceptación del PO — agosto 2026

---

## 1. Resumen ejecutivo

Auditoría funcional real (consultas SQL directas y llamadas de API reales contra
producción, no revisión de memoria) hecha antes de que el PO haga sus pruebas de
aceptación. **Se encontró y corrigió 1 bug real de integridad** durante la propia
auditoría (ver sección 3). El resto de la plataforma responde correctamente a los
requisitos R0-R7 y a las decisiones de producto acumuladas.

---

## 2. Estado del banco de contenido

| Métrica | Valor |
|---|---|
| Preguntas totales | 484 |
| Publicadas | 476 |
| Borrador | 8 |
| Retiradas | 0 |
| Clusters de caso | 19 |
| Cobertura de las 26 tareas ECO | 100% (0 huecos) |
| Cobertura de las 6 dimensiones de etiqueta (DO/CI/AE/DD/FO/NT) | 100% (484/484) |
| Rechazos registrados por el PO | 0 (aún no ha empezado a revisar) |

### Distribución real vs objetivo (R1)

| Dimensión | Objetivo | Real | Estado |
|---|---|---|---|
| Dominio — People | 33% | 40,5% | 🟡 por encima |
| Dominio — Process | 41% | 41,6% | ✅ |
| Dominio — Business Environment | 26% | **17,9%** | 🔴 notablemente por debajo |
| Enfoque — Predictivo | 40% | 44,7% | 🟡 cerca |
| Enfoque — Ágil + Híbrido | 60% | 55,2% | 🟡 cerca |
| Formato — Tipo test única | 60% | 58,8% | ✅ |
| Formato — Tipo test múltiple | 10% | 12,8% | ✅ |
| Formato — Casos | 20% | 14,7% | 🟡 por debajo |
| Formato — Interactivas | 10% | 13,7% | 🟡 por encima |

**Hallazgo más relevante**: Business Environment sigue notablemente por debajo del
26% objetivo (17,9% real). Esto coincide exactamente con lo que la spec de
extracción del corpus ATP señaló como riesgo ("subrepresentado en el corpus
original, priorizar generación aquí") — el propio proceso de generación no ha
compensado aún ese desequilibrio de origen. **Recomendación**: priorizar la
próxima tanda de generación en tareas ECO del dominio Business Environment.

---

## 3. Auditoría funcional — hallazgos

### 🔴 Bug real encontrado y corregido durante esta auditoría

**`submit_answer` no verificaba si la sección a la que pertenece una pregunta ya
estaba cerrada.** R6 promete que "una vez cierres una sección, no podrás volver a
cambiar sus respuestas" — pero esto solo lo bloqueaba la interfaz (navegación
deshabilitada), no el servidor. Verificado en vivo: fue posible enviar una
respuesta a una pregunta de la Sección 1 después de haberla finalizado
explícitamente vía `exam_section_control`.

**Corregido y verificado en el mismo turno**:
- `submit_answer` ahora consulta `exam_sections` antes de aceptar una respuesta en
  `full_sim`, y rechaza con `409` si la sección ya está `completed`.
- De paso, se añadió validación defensiva del cuerpo de la petición (antes, un
  campo `user_answer` mal formado o ausente causaba un `500 Internal Server
  Error` sin explicación; ahora devuelve un `400` claro).
- Verificado con 3 llamadas reales: sección cerrada → rechazada (409); sección
  abierta → aceptada (200); petición mal formada → rechazada con mensaje claro
  (400, no 500).

### ✅ Verificado correcto (llamadas reales, no solo revisión de código)

| Área | Prueba realizada | Resultado |
|---|---|---|
| `start_exam` — simulacro completo | Generación real | 180 preguntas, 3 secciones de 60, 240 min |
| `start_exam` — medio examen | Generación real | 90 preguntas, 120 min |
| `exam_section_control` | Ciclo completo finalizar→descanso→reanudar | Reloj se congela y se reanuda correctamente |
| `admin_questions` — filtro por etiqueta | `tag_code=DDRI` | 73 resultados, todos con la etiqueta correcta |
| Planes y precios | Consulta directa a `plans` | 4 planes, precios y features exactamente como en la home |
| Taxonomía de etiquetas | Consulta agregada | 484/484 con las 6 dimensiones, 0 huecos |
| Cobertura ECO | `validate_bank_readiness()` | 0 huecos en las 26 tareas |
| Los 4 generadores de contenido con IA | Generación real de cada uno tras el último despliegue | Sin errores, contexto de rechazos y few-shot activos |

### 🟡 Deuda técnica conocida, aún pendiente (no bloquea las pruebas del PO)

| Punto | Estado verificado ahora |
|---|---|
| `pg_cron` para expirar licencias | **No existe ni la extensión ni ninguna función `expire_licenses`** — confirmado con consulta directa, no solo "pendiente de programar" |
| SMTP propio en Supabase Auth | Sigue sin configurar (no se ha tocado en esta sesión) |
| Cuenta Stripe real | Sigue en modo test |

---

## 4. Roadmap — checklist de requisitos

| Req | Descripción | Estado |
|---|---|---|
| R0 | Preguntas situacionales | ✅ |
| R1 | Reparto por dominio/enfoque/área de enfoque/dominio de desempeño/formato/temática | ✅ implementado, 🟡 Business Environment por debajo del objetivo real (ver sección 2) |
| R2 | Una pregunta en pantalla | ✅ |
| R3 | Responder / dejar sin responder / marcar | ✅ |
| R4 | Navegación (siguiente/anterior/directa/marcadas/primera sin responder) | ✅ |
| R5 | 3 bloques de 60, casos en bloque 1 | ✅ |
| R6 | Revisión + finalizar sección + bloqueo permanente | ✅ **(bug de bloqueo real en backend encontrado y corregido en esta auditoría)** |
| R7 | Descanso opcional 10 min, reloj se congela, reanudación | ✅ |

**Extras entregados tras el R0-R7 inicial**: medio examen, feedback de usuarios,
sistema de etiquetas completo (6 dimensiones), numeración persistente de
preguntas + motivo de rechazo con aprendizaje automático hacia la generación,
few-shot de estilo desde corpus ATP curado, guardarraíl de terminología PMBOK 8,
9º tipo de distractor ("documento equivocado"), ajuste de negocio del plan
gratuito (medio examen de regalo en vez de completo).

---

## 5. Próximos pasos — propuesta de roadmap

### Prioridad alta (antes o justo después de las pruebas del PO)

1. **Generar contenido de Business Environment** — es el hueco más claro y
   accionable de todo el banco (17,9% real vs 26% objetivo). Con ~40 preguntas
   más de ese dominio se cerraría casi todo el hueco.
2. **Cerrar el backlog de 8 borradores** pendientes de revisión.
3. Que el PO empiece a usar el flujo de retirada con motivo en preguntas reales —
   es la primera vez que va a generar datos reales de aprendizaje para la
   generación futura.

### Prioridad media (antes de un lanzamiento real con usuarios de pago)

4. **`pg_cron` + función `expire_licenses`** — hoy no existe en absoluto, no es
   solo "falta programarlo". Sin esto, las licencias vencidas no se desactivan
   automáticamente.
5. **SMTP propio** en Supabase Auth (hoy usa el proveedor por defecto, con
   límites de envío no aptos para producción).
6. **Cuenta Stripe real** (fuera de modo test) antes de aceptar pagos reales.

### Mejoras de producto a considerar (sin urgencia)

7. **Few-shot con el corpus real completo**: solo se usaron 8-9 preguntas
   curadas manualmente de las 200 disponibles. Si se quiere ampliar la
   diversidad de estilo, se podría currar un lote mayor (con el mismo filtro de
   limpieza ya aplicado: sin PMBOK 6, sin residuos de traducción).
8. **Generador dedicado de preguntas PERT** (three-point estimating) — hoy solo
   hay generador determinista para EVM y diagrama de red/CPM; PERT se cubre solo
   vía el generador general de IA, sin el mismo nivel de garantía matemática.
9. **Reequilibrar enfoque predictivo/ágil** (44,7%/55,2% real vs 40%/60%
   objetivo) — desviación pequeña pero real, corregible priorizando ágil/híbrido
   en la próxima generación.
10. **Revisar la proporción de casos** (14,7% real vs 20% objetivo) — con 70
    casos en el banco hay de sobra para cubrir un examen individual (36
    necesarios), pero como proporción del banco global ha bajado según ha
    crecido el resto del contenido.

---

## 6. Metodología de esta auditoría

Todo lo marcado como "✅ verificado" en este informe se comprobó con una llamada
de API real o una consulta SQL directa contra la base de datos de producción
durante esta misma sesión — no es una relectura de informes anteriores. El bug de
`submit_answer` se descubrió precisamente por seguir este método (probar el
bloqueo de sección con una llamada directa, no solo confiar en que la interfaz
lo impide).
