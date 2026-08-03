-- =========================================================
-- 0032: Dominios de Desempeño (independiente de las 26 tareas) + fix crítico de
-- atomicidad de casos en full_sim + primer ejemplo de enhanced_matching
--
-- Aclaraciones del PO recibidas en esta sesión:
--
-- 1. Dominios de Desempeño (Gobernanza/Alcance/Cronograma/Finanzas/Recursos/Riesgos/
--    Interesados) NO se empareja con las 26 tareas del ECO 2026 -- es una etiqueta
--    independiente por pregunta, igual que Área de Enfoque. Ningún simulador hace
--    ese emparejamiento con las tareas.
--
-- 2. "Emparejamiento Mejorado" (enhanced_matching) del ECO 2026 significa
--    emparejamiento a nivel de GRÁFICOS (no solo texto como el matching normal),
--    pudiendo admitir varios emparejamientos válidos como solución (pero siempre
--    de uno a uno cada emparejamiento individual).
--
-- 3. Un caso/escenario SIEMPRE tiene varias preguntas asociadas, y al elegir un caso
--    para el examen se deben elegir SIEMPRE TODAS sus preguntas -- nunca un
--    subconjunto. Se encontró y corrigió un bug real: selectFullSim elegía preguntas
--    una a una sin noción de cluster, así que un caso de 3 preguntas podía quedar
--    con solo 1 o 2 elegidas si la cuota del bucket dominio+enfoque se llenaba antes.
--
-- La presentación al candidato (enunciado del caso fijo en pantalla mientras cambian
-- las preguntas) YA estaba implementada correctamente -- verificado en el código de
-- examen.tsx en una sesión anterior (cluster.title/scenarioText se renderizan en un
-- panel persistente junto a cada pregunta hija).
-- =========================================================

create type performance_domain_type as enum ('gobernanza', 'alcance', 'cronograma', 'finanzas', 'recursos', 'riesgos', 'interesados');

alter table questions add column if not exists performance_domain performance_domain_type;

comment on column questions.performance_domain is
  'Dominio de desempeño (Gobernanza/Alcance/Cronograma/Finanzas/Recursos/Riesgos/
   Interesados) -- requisito del PO, objetivo ~14-15% cada uno en el simulacro
   completo. Etiqueta independiente de la tarea ECO asignada (aclarado por el PO:
   no se empareja con las 26 tareas, se decide directamente por el contenido de la
   pregunta). Nullable: preguntas anteriores a este requisito no lo tienen asignado.';
