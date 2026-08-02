# Prompt para Lovable — Página `/faq` completa + acordeón corto en home

> Pega esto en el chat de Lovable. Sustituye el FAQ actual de la home (acordeón con 5
> preguntas) por una versión corta que enlaza a una página `/faq` nueva y completa.

## Contexto

Analizamos el FAQ de un competidor (pablolledo.com) como referencia de qué tipo de
preguntas hace este público. La mayoría de las suyas no aplican (son de una tienda
BigCommerce vieja: PayPal, MoneyGram, descarga de PDFs...), pero el patrón de preguntas
sí es útil. Redactamos las nuestras adaptadas, incluyendo dos cosas nuevas: el plan
gratuito y el diploma de logro que ya están implementados en el backend.

## 1. Página nueva `/faq`

Crea la ruta `/faq` con las 15 preguntas completas, organizadas en 3 bloques con
subtítulo (`h2`), en este orden y con este contenido exacto (no lo resumas ni lo
parafrasees, es contenido ya revisado):

### Bloque "Sobre el simulador"

**¿Está afiliado o avalado por PMI?**
No. PMTech Simulator es un producto independiente, no afiliado ni respaldado por el
Project Management Institute (PMI)®. PMP® y PMBOK® son marcas registradas de PMI.

**¿El simulador garantiza que apruebe el examen?**
No, y desconfía de quien lo prometa. Es una herramienta de entrenamiento y diagnóstico
que te da una estimación razonada de tu preparación real — complementa el estudio
estructurado, la revisión de tus errores y tu experiencia profesional, no los sustituye.

**¿Está actualizado a los últimos cambios del examen (ECO 2026 / PMBOK 8)?**
Sí, desde el primer día. El banco de preguntas está calibrado a las 26 tareas del ECO
vigente desde julio de 2026, con los pesos reales de dominio (Personas 33%, Proceso 41%,
Entorno de negocio 26%) y el split de enfoque (40% predictivo / 60% ágil-híbrido). Muchos
simuladores en español todavía siguen calibrados al examen anterior.

**¿Es totalmente en español?**
Sí, redactado en español neutro para España y LATAM, no traducido automáticamente.

**¿Las preguntas incluyen explicaciones?**
Sí, y vamos un paso más allá: cuando fallas, no solo te decimos cuál era la respuesta
correcta, identificamos el tipo de error concreto (secuencia, rol, enfoque, análisis,
conocimiento, interpretación, lectura o tiempo) para que sepas exactamente qué corregir.

**¿Puedo practicar tantas veces y en el orden que quiera?**
Sí. Puedes repetir la práctica por dominio, por lección o acumulativa las veces que
quieras mientras tu licencia esté activa, en cualquier orden.

**¿El nivel de dificultad es similar al del examen real?**
Sí, buscamos que sea equivalente: escenarios situacionales que evalúan juicio, no
memorización, con la misma estructura de opción múltiple, opción múltiple con varias
respuestas correctas, y formatos interactivos (arrastrar/emparejar, análisis de
gráficos, selección sobre imagen) que ya incluye el examen real.

**¿Hay que instalar algo?**
No. Es 100% web, funciona en el navegador de tu ordenador, tablet o móvil, sin ninguna
aplicación que instalar.

### Bloque "Sobre planes y pagos"

**¿Qué incluye el plan gratuito y cómo paso a uno de pago?**
El plan gratuito te da acceso sin límite de tiempo a la práctica por dominio, por
lección y acumulativa, más un simulacro completo de regalo para que pruebes la
estructura real del examen. Cuando quieras simulacros completos ilimitados y el resto
de funciones (práctica interactiva avanzada, analítica por tarea, motor adaptativo),
puedes mejorar tu plan en cualquier momento desde tu perfil — no pierdes tu progreso ni
tienes que crear una cuenta nueva.

**¿Puedo cambiar de plan Básica a Premium más adelante?**
Sí, puedes hacer upgrade en cualquier momento dentro de tu periodo de licencia; solo
pagas la diferencia.

**¿Cuánto tiempo tengo de acceso?**
El plan gratuito no caduca hasta que decidas mejorarlo. La Básica incluye 3 meses de
acceso y la Premium 6 meses, ambos con acceso ilimitado 24/7 durante ese periodo.

**¿Si repito el simulador o vuelvo a comprar, son las mismas preguntas?**
No necesariamente — a diferencia de un banco de preguntas fijo, el nuestro crece con el
tiempo a medida que se revisa y publica contenido nuevo, así que es probable que
encuentres preguntas que no habías visto antes, especialmente si ha pasado tiempo entre
una licencia y la siguiente.

**¿Qué pasa si mi licencia caduca antes del examen?**
Puedes renovar cuando quieras. Si detectamos que tu dominio en Business Environment (el
área que más pesa en el ECO 2026) sigue bajo al vencer, te avisamos — no dejamos que
llegues al examen sin saberlo.

### Bloque "Sobre la certificación PMP"

**¿Recibo algún diploma o certificado?**
Sí. Al completar un simulacro completo con un buen desempeño, se emite automáticamente
un diploma de logro con tu resultado por dominio. Una aclaración importante: PMI no
publica una nota de corte oficial para el examen PMP (usa bandas de desempeño por
dominio, no un porcentaje público) — el diploma reconoce tu desempeño según un criterio
de referencia propio de PMTech Simulator, no una nota de aprobado oficial de PMI.

**¿Sirve si estoy usando otro material de estudio (Rita Mulcahy, PMBOK, etc.)?**
Sí, es el complemento natural. El simulador no sustituye la formación estructurada —
está pensado para practicar y diagnosticar errores sobre lo que ya estás estudiando.

## 2. SEO de la página `/faq`

- `<title>`: "Preguntas frecuentes — PMTech Simulator"
- Meta description resumiendo los 3 bloques.
- JSON-LD `FAQPage` con las 15 preguntas — **solo si el texto de cada pregunta/respuesta
  es visible literalmente en el HTML renderizado**, no solo en el schema (si no, Google
  puede penalizar el schema).
- Enlace desde el footer (ya existe "FAQ" en la navegación de la home — apúntalo a
  `/faq` en vez de al ancla `#faq`).

## 3. Acordeón corto en la home (sustituye al actual)

Deja solo estas 5 preguntas en la home, en este orden, cada una enlazando su propia
ancla dentro de `/faq` si el usuario hace click en "Ver todas":

1. ¿Está afiliado o avalado por PMI?
2. ¿El simulador garantiza que apruebe el examen?
3. ¿Está actualizado a los últimos cambios del examen (ECO 2026 / PMBOK 8)?
4. ¿Qué incluye el plan gratuito y cómo paso a uno de pago?
5. ¿Recibo algún diploma o certificado?

Debajo del acordeón, añade un botón/enlace **"Ver todas las preguntas frecuentes →"**
que lleve a `/faq`.

## 4. Mostrar el diploma en la app (nuevo, backend ya listo)

`finish_exam` ahora devuelve, cuando corresponde, un campo `diploma: { id, issued_at,
threshold_pct, disclaimer }`. En la pantalla de resultado del simulacro completo:

- Si `diploma` no es `null`, muestra una tarjeta/banner destacado: "🎓 ¡Diploma
  desbloqueado!" con la fecha y el disclaimer (`diploma.disclaimer`) visible, no oculto
  en un tooltip — es importante que la aclaración de que no es una nota de corte oficial
  de PMI se vea siempre junto al diploma, igual que el disclaimer general de resultado.
- Añade una sección "Mis diplomas" en `/perfil` o `/historial` que liste los diplomas
  del usuario (tabla `diplomas`, filtrable por RLS a los propios — puedes hacer
  `supabase.from("diplomas").select("*, exams(finished_at)").order("issued_at", {
  ascending: false })` directamente desde cliente, la RLS ya restringe a los propios).
- El diseño del diploma puede ser simple por ahora (tarjeta con nombre del usuario,
  fecha, score_pct, score_by_domain) — no hace falta generar un PDF descargable en esta
  primera versión, pero déjalo preparado para añadir un botón "Descargar" más adelante.
