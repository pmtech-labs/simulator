# Añadido al prompt de Lovable — Recuperación de contraseña

> Pega esto en el chat de Lovable del mismo proyecto (complementa `02-prompt-frontend-lovable.md`).

Añade a la pantalla de login un enlace "¿Olvidaste tu contraseña?" que lleve a un flujo de recuperación:

1. **`/forgot-password`**: formulario con un solo campo (email). Al enviar, llama a
   `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<url-de-tu-app>/reset-password' })`.
   Muestra un mensaje genérico de confirmación ("Si el email existe, recibirás un enlace") independientemente
   de si el email existe o no, para no filtrar qué correos están registrados.

2. **`/reset-password`**: página a la que llega el usuario desde el enlace del email. Supabase Auth coloca
   la sesión de recuperación automáticamente al cargar la página (el cliente de Supabase ya gestiona el token
   de la URL). Muestra un formulario de nueva contraseña (con confirmación) y al enviar llama a
   `supabase.auth.updateUser({ password: nuevaPassword })`. Tras éxito, redirige al login o al dashboard.

3. Añade también el mismo enlace "¿Olvidaste tu contraseña?" en la pantalla de login del panel `/admin`,
   ya que los admins entran por el mismo sistema de autenticación que los candidatos.
