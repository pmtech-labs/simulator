-- =========================================================
-- 0026: Filtro de práctica por enfoque (predictivo/ágil/híbrido/combinado)
--
-- Confirmado como hueco real al comparar contra un competidor (filtros "Ciclos
-- predictivos" / "Ciclos adaptativos"). start_exam ya soportaba el campo 'approach'
-- en la tabla, pero no lo exponía como filtro de selección en modos de práctica.
--
-- Solo aplica a modos de práctica (domain_drill/custom/unit_quiz/cumulative) --
-- full_sim nunca lo usa, ya tiene su propio reparto real 40% predictivo / 60%
-- ágil-híbrido.
--
-- Verificado con prueba real: exam con approach_filter='agile_hybrid' devolvió 32
-- preguntas, comprobado directamente en base de datos que son 19 agile + 13 hybrid,
-- 0 predictive.
-- =========================================================

-- No requiere cambios de esquema -- el campo approach_filter se recibe en el body
-- de start_exam y se usa solo para filtrar la consulta, no se persiste como columna
-- nueva (config del examen ya se guarda completa en exams.config jsonb).
select 1; -- no-op, migración documental
