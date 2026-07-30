# Backend — Simulador PMP (ECO 2026)

Backend del simulador de examen PMP®, no afiliado a PMI. Base de datos y lógica de negocio en Supabase
(Postgres + Edge Functions). Frontend construido por separado en Lovable.

Referencia completa de arquitectura: `docs/01-especificacion-tecnica-producto.md` en la raíz del repo.

## Estructura

```
backend/
├── supabase/
│   ├── migrations/        # DDL versionado, aplicar en orden (0001 → 0007)
│   ├── seed/               # Seed de la taxonomía ECO 2026 (idempotente)
│   ├── functions/          # Edge Functions (Deno)
│   │   ├── start_exam/
│   │   ├── submit_answer/
│   │   ├── finish_exam/
│   │   ├── stripe_webhook/
│   │   ├── expire_licenses/
│   │   └── _shared/
│   └── config.toml
├── scripts/                 # Pipeline de generación/validación del banco (Node/TS)
│   ├── generate_questions.ts
│   ├── validate_questions.ts
│   └── coverage_audit.ts
├── package.json
└── .env.example
```

## Setup local

```bash
# 1. Instalar dependencias de los scripts
cd backend
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# rellenar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, STRIPE_*

# 3. Vincular el proyecto Supabase (una sola vez)
supabase login
supabase link --project-ref <project-ref>

# 4. Aplicar migraciones
supabase db push

# 5. Sembrar la taxonomía ECO 2026
supabase db execute -f supabase/seed/seed_eco_2026.sql

# 6. Desplegar Edge Functions
supabase functions deploy start_exam
supabase functions deploy submit_answer
supabase functions deploy finish_exam
supabase functions deploy stripe_webhook --no-verify-jwt
supabase functions deploy expire_licenses --no-verify-jwt

# 7. Configurar secrets de las Edge Functions (no van en .env del cliente)
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## Pipeline de generación del banco de preguntas

```bash
# Generar 10 preguntas para una tarea ECO concreta
TASK_ID=<uuid-de-eco_tasks> APPROACH=predictive FORMAT=mc_single COUNT=10 npm run generate

# Validar forma de todos los drafts pendientes (draft -> in_review)
npm run validate

# Auditar cobertura del banco por las 26 tareas ECO
npm run audit
```

La revisión humana (in_review -> approved -> published) se hace directamente en la tabla `questions`
desde el SQL editor de Supabase o desde un panel de administración (pendiente en el roadmap v1.1).
Ningún ítem con `status != 'published'` es servible al frontend (las políticas RLS ya lo garantizan).

## Cron de expiración de licencias

Programar en Supabase (SQL editor, requiere extensión `pg_cron` y `pg_net`):

```sql
select cron.schedule(
  'expire-licenses-hourly',
  '0 * * * *',
  $$ select net.http_post(url:='https://<project-ref>.supabase.co/functions/v1/expire_licenses') $$
);
```

## Webhook de Stripe

Configurar en el Dashboard de Stripe → Developers → Webhooks:
`https://<project-ref>.supabase.co/functions/v1/stripe_webhook`
Eventos a escuchar: `checkout.session.completed`, `customer.subscription.deleted`.

Importante: al crear la sesión de Stripe Checkout desde el frontend, incluir:
- `client_reference_id`: el `user_id` de Supabase Auth del comprador.
- `metadata.plan_code`: `basica_3m` o `premium_6m`.
