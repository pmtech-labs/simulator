# Prompt para Lovable — "Probar gratis" con plan gratuito real (sin cronómetro de sesión)

> Pega esto en el chat de Lovable. Sustituye el comportamiento actual de "Empezar ahora"
> (que hoy lleva a precios/compra) por un registro gratuito real con acceso inmediato,
> distinto del competidor: sin cronómetro de 30 minutos, con un plan gratuito genuino.

## Contexto — decisión de producto tomada

En vez de un trial con reloj de sesión (como hace el competidor pmsimulador.com, 30 min),
el plan gratuito da:
- Práctica por dominio/lección/acumulativo **sin límite de tiempo**.
- **Un simulacro completo (full_sim) de regalo**, controlado por uso, no por cronómetro.
- Sin practicum completo (hotspot/gráficos), igual que la Básica de pago.

El backend ya está listo: nueva Edge Function `provision_free_license` (crea la licencia
gratuita automáticamente, idempotente — si el usuario ya tiene una licencia activa no
hace nada), y `start_exam` ya bloquea un segundo `full_sim` en plan `free` con un mensaje
claro (`403`, texto: *"Ya usaste tu simulacro completo de regalo del plan gratuito..."*).

## 1. Cambiar el CTA principal

- Botón "Empezar ahora" (home, header, footer) → renómbralo a **"Probar gratis"**.
- Debe llevar directamente a `/registro` **sin parámetro de plan** (o con `?plan=free`
  si prefieres mantener la lógica de "plan preseleccionado" que ya existe para
  Básica/Premium, pero en este caso no debe llevar a `/checkout` en ningún caso).
- El botón "Entrar" del header (ya existente) no cambia — sigue llevando a `/login`,
  equivalente al "Entrar" del competidor.

## 2. Aprovisionar la licencia gratuita tras el registro

En el flujo de `/registro`, justo después de que `supabase.auth.signUp()` tenga éxito
(y la sesión quede iniciada), llama a la nueva función:

```ts
const { data, error } = await supabase.functions.invoke("provision_free_license", {
  method: "POST",
});
```

- Si `data.created === true`, el usuario ya tiene su licencia gratuita activa — redirige
  directamente a `/dashboard` (no a `/checkout`, no a ninguna pantalla de pago).
- Si `data.created === false` (ya tenía una licencia activa de otro tipo, caso raro en
  registro nuevo pero posible si hay reintentos), igualmente redirige a `/dashboard` sin
  mostrar error al usuario.
- Si la función falla por completo (error de red, etc.), muestra un aviso pero permite
  seguir — el usuario ya tiene cuenta creada, solo falta la licencia; podría reintentarse
  más adelante o desde soporte.

## 3. Mensaje claro cuando se agota el simulacro de regalo

Cuando el usuario en plan `free` intenta lanzar un segundo `full_sim`, `start_exam`
devuelve un error 403 con el texto exacto para mostrar. En la pantalla de configuración
de examen (donde se elige el modo), si el usuario está en plan `free` y ya usó su
simulacro de regalo (puedes consultarlo leyendo su licencia — `free_full_sim_used` — o
simplemente capturando el error 403 al intentar lanzarlo):

- Deshabilita visualmente la opción "Simulacro completo" con un badge "Ya usado — mejora
  tu plan" en vez de dejar que falle silenciosamente al pulsar.
- Las demás opciones (práctica por dominio, por lección, acumulativo) siguen disponibles
  sin restricción para plan `free`.
- Incluye un CTA claro hacia `/precios` o `/checkout?plan=premium_6m` en ese mismo punto
  — es el momento de mayor intención de compra (acaba de "gastar" su regalo).

## 4. Reflejar el plan gratuito en `/precios` y en el perfil

- Añade una tercera columna/tarjeta "Gratis" en la sección de precios de la home, junto
  a Básica y Premium, con su propio CTA "Probar gratis" (mismo destino que el botón
  principal). Lista de qué incluye: práctica ilimitada por dominio/lección, 1 simulacro
  completo de regalo, sin practicum completo.
- En `/perfil`, si el plan activo es `free`, muestra claramente "Plan gratuito" (no
  "Básica" ni nada que sugiera que es de pago) y si `free_full_sim_used` es `true`, un
  aviso de que ya usó su simulacro de regalo con el mismo CTA de upgrade.
