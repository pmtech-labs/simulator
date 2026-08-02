-- =========================================================
-- 0019: Plan gratuito (freemium sin cronómetro de sesión)
--
-- Contexto: un competidor da 30 min de prueba con reloj corriendo. Decisión de
-- producto: en vez de un cronómetro (genera ansiedad en el momento equivocado y no da
-- tiempo a ver el diferencial real -- el diagnóstico por tipo de error), el plan
-- gratuito da:
--  - Práctica por dominio/lección/acumulativo SIN límite de tiempo de sesión.
--  - UN simulacro completo (full_sim) de regalo, controlado por uso (no por reloj).
--  - Sin practicum completo (hotspot/graphic_based), como la Básica de pago.
--
-- NOTA: alter type ... add value no puede usarse en la misma transacción que su
-- primer uso (error de Postgres 55P04) -- si se reaplica desde cero, ejecutar el
-- ALTER TYPE en su propia migración/transacción antes que el resto.
-- =========================================================

alter type plan_code add value if not exists 'free';
