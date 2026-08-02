# Prompt para Lovable — Actualizar frontend tras simplificar estados a 3

> Pega esto en el chat de Lovable. El backend ya migró de 5 a 3 estados
> (`draft`/`published`/`retired`, sin `in_review` ni `approved`).

## 1. `admin.review.tsx`

- Línea ~26: `const STATUSES = ["draft", "in_review", "approved", "published", "retired"];`
  → cambiar a `const STATUSES = ["draft", "published", "retired"];`
- Línea ~36: `const [statuses, setStatuses] = useState<string[]>(["draft", "in_review"]);`
  → cambiar a `const [statuses, setStatuses] = useState<string[]>(["draft"]);` (el filtro
  por defecto ahora solo necesita `draft`, ya no hace falta combinar dos estados).
- Revisa cualquier botón/acción que ofreciera pasar a `in_review` o `approved` como paso
  intermedio — ahora el flujo es directo: `draft` → (revisar) → `published`, o `draft` →
  `retired` si se descarta sin publicar.

## 2. `admin.index.tsx` (dashboard)

- Línea ~72: `acc.in_review += Number(r.in_review_count ?? 0);` — el backend sigue
  devolviendo `in_review_count` en `v_task_coverage` (por compatibilidad), pero **siempre
  será 0** a partir de ahora. Quita esta línea y cualquier tarjeta/contador que muestre
  "en revisión" en el dashboard — ya no aporta información real.

## 3. `adminService.ts`

- Línea ~78: `in_review_count: number` en el tipo — puedes dejarlo (el campo sigue
  existiendo en la respuesta, solo que fijo a 0) o quitarlo si prefieres limpiar del todo;
  no rompe nada mantenerlo.

## 4. Cualquier otro sitio con `in_review` o `approved`

Busca en todo el proyecto (`grep -r "in_review\|approved"` sobre `src/`) por si queda
algún badge de color, texto de estado o lógica condicional que mencione esos dos valores
— con el enum ya reducido a 3 en la base de datos, cualquier pregunta que antes estuviera
en esos estados ya se migró automáticamente (no hay filas afectadas en la práctica, la
migración se aplicó sobre un banco donde nadie los usaba), pero el código del frontend
que los mencione debe limpiarse para que no queden opciones muertas en la interfaz.
