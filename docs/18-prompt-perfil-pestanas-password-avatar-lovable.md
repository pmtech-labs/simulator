# Prompt para Lovable — Perfil con pestañas + cambio de contraseña real + avatar

> Pega esto en el chat de Lovable. Reorganiza `/perfil` en dos pestañas y añade
> funcionalidad que hoy no existe (cambio de contraseña dentro de la app, avatar).

## Contexto

Revisamos el perfil de un competidor como referencia de UX (no de contenido — solo la
estructura). Tienen dos pestañas claras (Datos Personales / Seguridad) y permiten
cambiar la contraseña sin salir de la app, algo que nosotros hoy no tenemos: solo existe
el flujo de "olvidé mi contraseña" por email, que es más lento para alguien que ya
conoce su contraseña actual y solo quiere cambiarla.

## 1. Reestructurar `/perfil` en dos pestañas

Mantén todo lo que ya existe (datos de la cuenta, estadísticas por dominio, planes
disponibles), pero reorganízalo así:

**Pestaña "Datos Personales"** (contenido actual de "Datos de la cuenta" + estadísticas
+ planes, tal cual están hoy):
- Nombre (editable)
- Email — **de solo lectura**, con el texto de ayuda: *"Para modificar tu email,
  contacta con soporte"* (enlaza al email de contacto que ya tenemos en el aviso legal
  del registro). No implementes cambio de email self-service — es una fuente habitual
  de problemas de seguridad/duplicados y no aporta valor suficiente ahora mismo.
- Avatar con botón "Randomizar" (ver punto 3).
- Resto del contenido actual (estadísticas por dominio, planes disponibles) se queda
  igual, puedes dejarlo dentro de esta misma pestaña o justo debajo de las pestañas.

**Pestaña "Seguridad"** (nueva):
- Contraseña actual
- Nueva contraseña
- Confirmar contraseña
- Botón "Cambiar Contraseña"

## 2. Cambio de contraseña — implementación correcta, no solo visual

Importante: `supabase.auth.updateUser({ password })` **no verifica la contraseña
actual** por sí solo (solo requiere una sesión válida). Para que el campo "Contraseña
actual" sea una verificación real y no solo un campo decorativo, hazlo en dos pasos:

```ts
async function changePassword(currentPassword: string, newPassword: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("No se pudo obtener el usuario");

  // 1. Verificar la contraseña actual re-autenticando con ella
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) throw new Error("La contraseña actual no es correcta");

  // 2. Solo si la verificación anterior tuvo éxito, actualizar a la nueva
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;
}
```

- Valida que "Nueva contraseña" y "Confirmar contraseña" coincidan antes de llamar a
  la función (validación de formulario, cliente).
- Aplica la misma política de longitud mínima que ya uséis en el registro.
- Muestra un mensaje de éxito claro tras el cambio ("Contraseña actualizada
  correctamente") y limpia los tres campos.

## 3. Avatar con "Randomizar"

No hace falta construir un generador propio — usa la API pública de DiceBear (gratuita,
sin necesidad de API key para uso básico):

```ts
// Genera una URL de avatar a partir de una semilla (guarda la semilla, no la imagen)
const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
```

- Al pulsar "Randomizar", genera una nueva semilla aleatoria (`crypto.randomUUID()` o
  similar), guárdala en el perfil del usuario (columna `avatar_seed` en vuestra tabla de
  perfiles — si no existe, créala) y actualiza la imagen mostrada.
- Muestra el avatar actual (o uno por defecto generado a partir del `user.id` si el
  usuario nunca lo ha randomizado) junto al nombre en el sidebar, donde ya mostráis el
  nombre y el plan actual.

## 4. Qué NO añadir (decisión deliberada, no descuido)

No añadas campos de "Teléfono" ni "País" al formulario. El competidor los tiene, pero
no tenemos ningún uso real definido para esos datos todavía — pedir datos personales sin
una finalidad concreta va contra el principio de minimización de datos del RGPD que ya
aplicamos en el aviso legal del registro. Si en el futuro se necesitan (por ejemplo,
para notificaciones por WhatsApp), se añaden entonces con su finalidad declarada.

## 5. Indicador de nivel de preparación (Premium) — nuevo, backend ya listo

Inspirado en la "predicción de aprobado" que ofrece el competidor, pero planteado con
honestidad: no existe una fórmula oficial que traduzca desempeño en simulacros a una
probabilidad real de aprobar el examen, así que en vez de un falso "% de probabilidad"
construimos un indicador cualitativo (Bajo/Moderado/Bueno/Alto) con su disclaimer
siempre visible.

Ya está desplegada `readiness_prediction` (GET, requiere plan Premium — devuelve 403 en
Básica/Gratis). Añádelo en `/progreso`, como tarjeta destacada (encaja bien donde el
competidor gatea sus "Estadísticas Avanzadas" detrás de "Mejorar Plan" — mismo hueco,
contenido honesto):

```ts
const { data, error } = await supabase.functions.invoke("readiness_prediction", {
  method: "GET",
});
```

Comportamiento según la respuesta:

- **Si el usuario no es Premium** (error 403): muestra la tarjeta bloqueada con un CTA
  "Mejorar a Premium" — mismo patrón que ya usáis para otras funciones gateadas.
- **Si `data_sufficient === false`**: muestra `data.message` tal cual (ya viene
  redactado, ej. "Practica al menos 20 preguntas para desbloquear tu indicador...").
- **Si `data_sufficient === true`**: muestra:
  - `data.band` como texto grande y destacado (Bajo/Moderado/Bueno/Alto), con un color
    acorde (rojo/ámbar/verde claro/verde) — no un semáforo agresivo, algo sobrio.
  - `data.readiness_score` como número de apoyo, más pequeño.
  - Desglose por dominio (`data.score_by_domain`) en una mini-barra por dominio, igual
    que ya hacéis en el resto de la app.
  - **`data.disclaimer` visible siempre, no en un tooltip** — mismo criterio que el
    disclaimer de resultado y el del diploma: la aclaración de que no es una
    probabilidad real debe verse sin que el usuario tenga que buscarla.
  - Si `data.based_on_full_sims > 0`, puedes añadir una nota pequeña: *"Basado en tu
    dominio por tarea y tus últimos N simulacros completos."*
