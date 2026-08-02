# Prompt para Lovable — Aviso RGPD en registro + consentimiento de boletín

> Pega esto en el chat de Lovable. Sustituye cualquier texto legal genérico en `/registro`
> por el redactado abajo, y añade la casilla de consentimiento del boletín conectada al
> backend real.

## ⚠️ Antes de publicar: datos pendientes de rellenar

El texto legal de abajo tiene **3 huecos marcados entre corchetes** que debéis rellenar
con vuestros datos reales antes de publicarlo (razón social, NIF/CIF, dirección
completa). No los invento porque no tengo esa información — no publiquéis el texto con
los corchetes tal cual.

## 1. Casillas de consentimiento (deben ser DOS casillas separadas, no una)

RGPD exige consentimiento granular: aceptar condiciones del servicio es obligatorio para
poder registrarte; suscribirte al boletín es una finalidad distinta y debe poder
aceptarse (o no) independientemente.

```
☑ Acepto los Términos y Condiciones y la Política de Privacidad (obligatorio)

☐ Quiero recibir el boletín semanal PMP y novedades del producto (opcional)
```

## 2. Texto legal a mostrar debajo del botón de registro

Sustituye cualquier texto legal actual por este (letra pequeña, igual que ya hacíais):

> Al crear una cuenta, tratamos tus datos (nombre y correo electrónico) para gestionar
> tu registro y darte acceso al simulador, en base a la ejecución del contrato de
> servicio que aceptas. Si marcas la casilla del boletín, además trataremos tu correo
> para enviarte el boletín semanal y novedades, en base a tu consentimiento expreso —
> puedes retirarlo cuando quieras desde el enlace de baja en cualquier email o desde tu
> perfil, sin que afecte a tu cuenta del simulador.
>
> **Responsable del tratamiento:** [Razón social completa], con NIF [NIF/CIF] y domicilio
> en [dirección completa].
>
> **Encargados de tratamiento:** usamos Supabase (alojamiento y autenticación), Resend
> (envío de correos y del boletín) y, si te suscribes al boletín, Substack (plataforma
> de envío del boletín semanal) — todos actúan como encargados de tratamiento bajo
> nuestras instrucciones, nunca ceden tus datos a terceros con fines propios.
>
> **Tus derechos:** puedes ejercer tus derechos de acceso, rectificación, supresión,
> limitación, portabilidad y oposición escribiendo a [email de contacto]. Más detalles en
> nuestra [Política de Privacidad](/privacidad) completa.

## 3. Conectar la casilla del boletín al backend real

Cuando el usuario marca la casilla de boletín y completa el registro:

```ts
// Justo después de que supabase.auth.signUp() tenga éxito (mismo punto donde ya
// se llama a provision_free_license)
if (wantsNewsletter) {
  await supabase.functions.invoke("subscribe_newsletter", {
    method: "POST",
    body: {
      email: formValues.email,
      full_name: formValues.fullName, // o como se llame el campo de nombre en el form
    },
  });
}
```

- No bloquees el registro si esta llamada falla — el usuario ya tiene su cuenta creada;
  el consentimiento del boletín se puede reconciliar después si hace falta.
- No muestres ningún mensaje de error al usuario si `subscribe_newsletter` falla; es una
  acción secundaria, no crítica para el flujo de registro.

## 4. Exportar suscriptores para Substack (opción B confirmada)

Ya está construido el backend: `export_newsletter_subscribers` (solo admin) devuelve un
CSV de los suscriptores nuevos desde la última exportación, y los marca como exportados
automáticamente.

Añade en el panel de administración (por ejemplo, junto a las estadísticas o en una
sección nueva "Boletín") un botón **"Exportar nuevos suscriptores (CSV)"**:

```ts
const handleExport = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export_newsletter_subscribers`,
    { headers: { Authorization: `Bearer ${session?.access_token}` } },
  );
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nuevos_suscriptores_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

Añade un texto de ayuda junto al botón: *"Descarga los nuevos suscriptores desde la
última exportación e impórtalos en Substack (Settings → Subscribers → Import) antes de
enviar el boletín semanal."* — es un paso manual pero rápido, pensado para hacerse una
vez por semana antes de cada envío.
