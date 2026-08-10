# Informe de avance vs roadmap — Simulador PMP (ECO 2026 / PMBOK 8)
### Auditoría funcional previa a pruebas de aceptación del PO — agosto 2026
### Actualizado: revisión completa del banco por el PO en curso

---

## 0. ⚠️ Estado actual: el simulador NO puede generar exámenes ahora mismo

**Todas las preguntas del banco (544) se pasaron a borrador** para que el PO las
revise una a una desde cero, incluidas las 476 que ya estaban publicadas
anteriormente. Esto es una decisión deliberada, no un error — pero tiene una
consecuencia real y directa: **con 0 preguntas publicadas, `start_exam` falla
para cualquier modo** (verificado con una llamada real):

```
POST /functions/v1/start_exam {"mode":"half_sim"}
→ {"error":"El banco no tiene cobertura completa: faltan preguntas
   publicadas en 26 tarea(s) ECO."}
```

**El simulador seguirá así hasta que el PO publique de nuevo, como mínimo, una
cobertura completa de las 26 tareas ECO.** No es necesario terminar de revisar
las 544 — en cuanto haya al menos 1 pregunta publicada por tarea, `start_exam`
volverá a funcionar (aunque con poca variedad hasta que avance más la revisión).

---

## 1. Resumen ejecutivo

Auditoría funcional real (consultas SQL directas y llamadas de API reales contra
producción, no revisión de memoria) hecha antes de que el PO haga sus pruebas de
aceptación. **Se encontraron y corrigieron varios bugs e incidencias de
seguridad reales** durante el proceso (ver secciones 3 y 3-bis) — no solo el bug
de integridad original, sino además un conjunto de hallazgos críticos de
seguridad detectados por una revisión externa y corregidos en esta misma sesión.
El PO ha empezado ahora la revisión manual completa del banco de contenido.

---

## 2. Estado del banco de contenido

| Métrica | Valor (auditoría inicial) | Valor (ahora, con revisión del PO en curso) |
|---|---|---|
| Preguntas totales | 484 | **544** (+60 generadas para Business Environment) |
| Publicadas | 476 | **0** — todas pasadas a borrador para revisión completa |
| Borrador | 8 | **544** |
| Retiradas | 0 | 0 |
| Clusters de caso | 19 | 22 |
| Cobertura de las 26 tareas ECO (publicadas) | 100% | **0%** — 26/26 tareas sin cobertura publicada (esperado, ver sección 0) |
| Rechazos registrados por el PO | 0 | 0 (aún no ha empezado a marcar rechazos) |

### Distribución del banco completo por dominio (todo en borrador ahora mismo)

| Dominio | Preguntas | % del banco |
|---|---|---|
| Business Environment | 145 | 26,7% |
| Process | 198 | 36,4% |
| People | 201 | 36,9% |

Nota: esta distribución ya no se compara contra el objetivo R1 (33/41/26) porque,
con todo en borrador, la comparación relevante será la del banco que el PO acabe
publicando, no la del banco completo antes de revisar. El hueco de Business
Environment (17,9% real vs 26% objetivo) que motivó la generación de 60 preguntas
nuevas ya está resuelto en términos de *volumen disponible* — ahora depende de
cuántas de esas 145 preguntas de Business Environment el PO decida publicar.

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

## 3-bis. Trabajo adicional realizado tras la auditoría original

### 🔴 Hallazgos críticos de seguridad (revisión externa) — corregidos y verificados

Una revisión de seguridad externa detectó 4 hallazgos críticos, todos corregidos
en esta sesión y verificados con llamadas reales (no solo revisión de código):

1. **Respuestas del examen expuestas a cualquiera**: una política de acceso en
   `questions` exponía `correct_answer`/`explanation` de toda pregunta publicada
   a cualquier visitante, autenticado o no, saltándose por completo la lógica de
   la app. Corregido con permisos a nivel de columna (nunca a nivel de tabla) —
   verificado que ahora una consulta directa a esas columnas devuelve `401`.
2. **Exámenes falsificables**: cualquier usuario autenticado podía insertar
   directamente una fila de examen con resultado inventado, sin pasar por
   `start_exam`/`finish_exam`. Corregido — verificado con un intento real de
   fabricar un examen: `403` rechazado.
3. **Datos de todos los usuarios expuestos sin autenticar**: la vista nueva de
   gestión de usuarios exponía email/plan/estado de administrador de *todos* los
   usuarios a cualquier visitante sin sesión. Corregida — verificado `401`.
4. **Patrón de vista insegura ("Security Definer View")**: dos vistas se
   convirtieron al patrón correcto (permisos por columna en la tabla base, o
   función con comprobación interna de administrador) en vez de saltarse la
   seguridad de la tabla por completo.

Durante la corrección se rompieron dos veces flujos legítimos por efecto
colateral (el panel de usuarios y el dashboard de etiquetas) — ambos
diagnosticados y corregidos en el mismo turno en que se reportaron, con
verificación en vivo en ambos casos.

### 🟢 Panel de administración — gestión de usuarios y métricas de negocio

Nuevas páginas en `/admin`:
- **Gestión de usuarios**: listar/filtrar por email o plan, y 4 acciones
  administrativas (extender licencia, cambiar de plan, revocar licencia,
  dar/quitar rol admin) — ninguna acción borra histórico, todo queda marcado o
  trazado.
- **Métricas de negocio**: MRR (normalizado a mensual), registros vs compras con
  % de conversión, ventas por plan — con filtros por semana/mes/año. **Limitación
  de datos real y documentada**: no existe tabla de pagos/pedidos, los importes
  se calculan con el precio *actual* de cada plan, no con el histórico realmente
  pagado (ver roadmap, punto 6-bis).

### 🟢 Conectores LLM — modelos recomendados y bug de parámetros corregido

- Recomendado pasar el conector de OpenAI de `gpt-4.1` (descatalogado, retirado
  de ChatGPT feb 2026) a **`gpt-5.4`** (no la variante mini — nuestro propio
  historial con `gpt-4.1` ya documentó fallos de seguimiento de instrucciones
  numéricas con modelos más ligeros: 44/44 preguntas con `difficulty=3` fijo en
  un bug pasado). Gemini (`gemini-3.6-flash`) ya era la opción óptima, sin cambios.
- **Bug real corregido antes de que causara una incidencia**: la API de OpenAI
  exige `max_completion_tokens` en vez de `max_tokens` para toda la familia
  GPT-5.x — nuestro código enviaba siempre `max_tokens`. Si se hubiera cambiado
  el conector a `gpt-5.4` sin este fix, la generación habría fallado por
  completo. Corregido y verificado con generaciones reales en los 4 generadores.
- De paso, se corrigió un parámetro de Gemini obsoleto (`thinkingBudget`, ya no
  soportado por Gemini 3.x) que había quedado como comentario sin efecto real en
  el código, arriesgando que el modelo gastara tokens de razonamiento interno y
  truncara el JSON de salida.

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

### Prioridad crítica (bloquea el funcionamiento del simulador ahora mismo)

0. **El PO debe revisar y publicar suficiente contenido para cubrir las 26
   tareas ECO** — con el banco entero en borrador, ningún modo de examen
   funciona (ver sección 0). No hace falta revisar las 544 de golpe: en cuanto
   haya al menos 1 pregunta publicada por tarea, `start_exam` vuelve a
   funcionar. Recomendable avisar al PO de este mínimo viable para desbloquear
   pruebas mientras continúa revisando el resto con calma.

### Prioridad alta (durante la revisión del PO)

1. Los rechazos que el PO vaya marcando con motivo ya retroalimentan
   automáticamente la generación futura (few-shot + contexto de rechazos) —
   sin ninguna acción adicional necesaria, pero merece la pena que el equipo
   sepa que cada motivo que escriba tiene impacto real, no es solo un registro.
2. Una vez el PO tenga una primera pasada de publicación, repetir la
   comparación real vs objetivo R1 (dominio/enfoque/formato) que se hizo en la
   auditoría original — sección 2 de este informe —, porque el banco publicado
   final puede no coincidir con las proporciones del banco completo en borrador.

### Prioridad media (antes de un lanzamiento real con usuarios de pago)

3. **`pg_cron` + función `expire_licenses`** — no existe en absoluto, no es
   solo "falta programarlo". Sin esto, las licencias vencidas no se desactivan
   automáticamente.
4. **SMTP propio** en Supabase Auth (hoy usa el proveedor por defecto, con
   límites de envío no aptos para producción).
5. **Cuenta Stripe real** (fuera de modo test) antes de aceptar pagos reales.
6. **Tabla de pedidos/pagos con precio congelado en el momento de la compra** —
   las métricas de negocio (MRR, ventas por plan) usan hoy el precio *actual*
   de cada plan; si el precio cambia en el futuro, el histórico se recalcularía
   retroactivamente de forma incorrecta.

### Mejoras de producto a considerar (sin urgencia)

7. **Few-shot con el corpus real completo**: solo se usaron 8-9 preguntas
   curadas manualmente de las 200 disponibles. Si se quiere ampliar la
   diversidad de estilo, se podría currar un lote mayor (con el mismo filtro de
   limpieza ya aplicado: sin PMBOK 6, sin residuos de traducción).
8. **Generador dedicado de preguntas PERT** (three-point estimating) — hoy solo
   hay generador determinista para EVM y diagrama de red/CPM; PERT se cubre solo
   vía el generador general de IA, sin el mismo nivel de garantía matemática.
9. **Reequilibrar enfoque predictivo/ágil** una vez el PO tenga una primera
   pasada de publicación — la auditoría original detectó una desviación pequeña
   pero real (44,7%/55,2% vs 40%/60% objetivo).
10. **Revisar la proporción de casos** una vez publicado de nuevo — la
    auditoría original detectó 14,7% real vs 20% objetivo como proporción del
    banco (aunque en volumen absoluto, 70+ casos son de sobra para un examen
    individual de 36).

---

## 6. Metodología de esta auditoría

Todo lo marcado como "✅ verificado" en este informe se comprobó con una llamada
de API real o una consulta SQL directa contra la base de datos de producción
durante esta misma sesión — no es una relectura de informes anteriores. El bug de
`submit_answer` se descubrió precisamente por seguir este método (probar el
bloqueo de sección con una llamada directa, no solo confiar en que la interfaz
lo impide). El mismo criterio se aplicó a los hallazgos de seguridad de la
sección 3-bis y al estado actual del banco (sección 0): el "banco no tiene
cobertura completa" no es una suposición a partir del recuento de filas, es la
respuesta literal de una llamada real a `start_exam` en el momento de escribir
este informe.
