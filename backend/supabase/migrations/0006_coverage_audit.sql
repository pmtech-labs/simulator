-- =========================================================
-- 0006: Auditoría de cobertura del banco por tarea ECO
-- Usada por scripts/coverage_audit.ts para dirigir dónde generar más contenido.
-- =========================================================

create or replace view v_task_coverage as
select
  d.code as domain_code,
  d.name as domain_name,
  d.weight_pct as domain_weight_pct,
  d.sort_order as domain_sort_order,
  t.id as task_id,
  t.task_number,
  t.title as task_title,
  count(q.id) filter (where q.status = 'published') as published_count,
  count(q.id) filter (where q.status = 'draft') as draft_count,
  count(q.id) filter (where q.status = 'in_review') as in_review_count,
  count(q.id) filter (where q.status = 'published' and q.approach = 'predictive') as published_predictive,
  count(q.id) filter (where q.status = 'published' and q.approach in ('agile','hybrid')) as published_agile_hybrid
from eco_tasks t
join eco_domains d on d.id = t.domain_id
left join questions q on q.task_id = t.id
group by d.code, d.name, d.weight_pct, d.sort_order, t.id, t.task_number, t.title
order by d.sort_order, t.task_number;

-- security_invoker: la vista debe respetar el RLS del usuario que consulta, no del creador.
alter view v_task_coverage set (security_invoker = true);

comment on view v_task_coverage is
  'Cobertura del banco publicado por tarea ECO. Una tarea con published_count = 0 bloquea la generación de un full_sim (ver validate_bank_readiness).';

-- Verifica que el banco tenga al menos 1 pregunta publicada por cada una de las 26 tareas.
-- start_exam debe llamar a esta función antes de generar un full_sim.
create or replace function validate_bank_readiness()
returns table(task_id uuid, task_title text, published_count bigint) as $$
  select task_id, task_title, published_count
  from v_task_coverage
  where published_count = 0;
$$ language sql stable set search_path = public;

comment on function validate_bank_readiness is
  'Devuelve las tareas ECO sin ninguna pregunta publicada. Si devuelve filas, un full_sim no puede generarse de forma representativa.';
