# Prompt para Lovable — Gestión de usuarios + Métricas de negocio en /admin

> Backend listo, desplegado y verificado con datos reales. Esto es frontend:
> dos páginas nuevas dentro del panel `/admin`, siguiendo el mismo patrón
> visual que ya tiene `admin.review.tsx` (sidebar, cabecera, tablas).

## ⚠️ Limitación de datos a mostrar en pantalla (importante)

No existe tabla de pagos/pedidos en el modelo de datos actual — todas las
cifras de ingresos se calculan con el precio **actual** de cada plan, no con
lo que se cobró de verdad en el momento histórico de cada compra. **Añade un
aviso discreto y permanente** (tipo banner o tooltip, no intrusivo) en la
página de métricas con este texto exacto, que el backend ya devuelve en el
campo `data_limitations` de la respuesta:

> "No existe tabla de pagos/pedidos: los importes se calculan con el precio
> ACTUAL de cada plan, no con el precio real pagado en el momento de cada
> compra histórica."

## 1. Nueva ruta: `/admin/usuarios` — gestión de usuarios

Llama a `GET /functions/v1/admin_users` (query params: `search`, `plan_code`,
`only_admins`, `limit`, `offset`).

Tabla con columnas: Email · Registrado (`signed_up_at`) · Último acceso
(`last_sign_in_at`) · Plan actual (`current_plan_code`, "Sin plan" si `null`)
· Estado licencia (`latest_license_status`) · Caduca (`current_expires_at`) ·
Exámenes realizados (`exams_taken`) · Admin (badge si `is_admin`) · Acciones.

Filtros arriba: buscador por email (input con debounce), select de plan
(Todos/Gratis/Básica/Premium 1 mes/Premium), checkbox "solo admins".

**Acciones por fila** (menú desplegable o botones), cada una llama a
`PATCH /functions/v1/admin_users` con `{ user_id, action, ...params }`:

```ts
// Extender licencia
{ user_id, action: "extend_license", days: 30 }

// Cambiar de plan (crea licencia nueva, la anterior se marca 'superseded')
{ user_id, action: "change_plan", plan_code: "premium_6m" }

// Revocar licencia activa
{ user_id, action: "revoke_license" }

// Dar/quitar rol admin
{ user_id, action: "toggle_admin", make_admin: true }
```

Pide confirmación (modal simple) antes de `revoke_license` y `toggle_admin`
(son acciones sensibles) — el resto puede aplicarse directo.

## 2. Nueva ruta: `/admin/metricas` — métricas de negocio

Llama a `GET /functions/v1/admin_metrics?granularity=month&periods=12` (un
selector de granularidad arriba: Semana / Mes / Año, que recarga la llamada
con el `granularity` correspondiente — usa `periods=12` para semana/mes y
`periods=6` o `periods=5` para año, para no pedir un histórico absurdo).

**Estructura de la página, de arriba a abajo:**

### A. Tarjetas de resumen (`summary`)
4 tarjetas tipo KPI: Usuarios totales (`total_users`) · Licencias de pago
activas (`active_paid_licenses`) · MRR actual (`current_mrr_cents / 100` €) ·
Conversión global (`overall_conversion_pct` %).

### B. Gráfico de tendencia MRR (`mrr_trend`)
Gráfico de líneas/área (recharts) con `period_start` en el eje X y
`mrr_cents/100` en el eje Y. Tooltip mostrando también `active_paid_licenses`
de ese periodo.

### C. Registros vs compras + conversión (`signups_vs_purchases`)
Gráfico de barras agrupadas (dos series: `signups` y `purchases`) por
`period_start`, con una línea superpuesta o una tabla al lado mostrando
`conversion_pct` de cada periodo.

### D. Ventas por producto (`sales_by_plan`)
Tabla o gráfico de barras horizontal: `plan_name` · `purchases` ·
`revenue_cents/100` €. Ordenado por `revenue_cents` descendente (el backend ya
lo devuelve así).

### E. Selector de rango para "Ventas por producto"
Como esta sección acepta un rango de fechas independiente
(`sales_from`/`sales_to`), añade un selector de fechas (o presets: "Último
mes" / "Último trimestre" / "Último año" / "Todo") que vuelva a llamar al
endpoint con esos parámetros.

## Ejemplo de tipos TypeScript para `adminService.ts`

```ts
export interface AdminUserRow {
  user_id: string;
  email: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  current_plan_code: string | null;
  latest_license_status: string | null;
  current_expires_at: string | null;
  paid_licenses_count: number;
  exams_taken: number;
  last_exam_at: string | null;
  is_admin: boolean;
}

export interface AdminMetricsResponse {
  summary: {
    total_users: number;
    active_paid_licenses: number;
    current_mrr_cents: number;
    overall_conversion_pct: number;
  };
  mrr_trend: { period_start: string; mrr_cents: number; active_paid_licenses: number }[];
  signups_vs_purchases: { period_start: string; signups: number; purchases: number; conversion_pct: number }[];
  sales_by_plan: { plan_code: string; plan_name: string; purchases: number; revenue_cents: number }[];
  data_limitations: string;
}
```

## Resumen de archivos a crear/tocar

| Archivo | Qué hace |
|---|---|
| `src/routes/admin.usuarios.tsx` (nuevo) | Tabla de usuarios con filtros y acciones |
| `src/routes/admin.metricas.tsx` (nuevo) | Dashboard de métricas con gráficos |
| `src/services/adminService.ts` | Tipos `AdminUserRow`/`AdminMetricsResponse` + funciones `listAdminUsers`, `patchAdminUser`, `getAdminMetrics` |
| Sidebar del panel admin (donde esté el menú de `/admin/*`) | Añadir enlaces a "Usuarios" y "Métricas" |
