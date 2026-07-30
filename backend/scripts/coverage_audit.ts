/**
 * scripts/coverage_audit.ts
 *
 * Etapa 4 del pipeline de contenido (ver prompt de Cowork, sección 2).
 * Reporta, por cada una de las 26 tareas ECO, cuántas preguntas 'published' existen
 * y compara contra el peso objetivo del dominio y el split predictive/agile+hybrid.
 * Usa la vista v_task_coverage (migración 0006).
 *
 * Uso: npm run audit
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TARGET_BANK_SIZE = 3500;
const DOMAIN_WEIGHTS: Record<string, number> = {
  people: 0.33,
  process: 0.41,
  business_environment: 0.26,
};

async function main() {
  const { data: rows, error } = await supabase
    .from("v_task_coverage")
    .select("*");

  if (error) throw new Error(error.message);
  if (!rows) return;

  console.log("=== Auditoría de cobertura del banco (ECO 2026) ===\n");

  const byDomain: Record<string, typeof rows> = {};
  for (const r of rows) {
    byDomain[r.domain_code] = byDomain[r.domain_code] ?? [];
    byDomain[r.domain_code].push(r);
  }

  let totalPublished = 0;
  const zeroTasks: string[] = [];

  for (const [domainCode, tasks] of Object.entries(byDomain)) {
    const weight = DOMAIN_WEIGHTS[domainCode] ?? 0;
    const domainTarget = Math.round(TARGET_BANK_SIZE * weight);
    const domainPublished = tasks.reduce((sum, t) => sum + Number(t.published_count), 0);

    console.log(`## ${tasks[0].domain_name} (peso examen: ${(weight * 100).toFixed(0)}%, objetivo banco: ~${domainTarget})`);
    console.log(`   Publicadas en el dominio: ${domainPublished}`);

    for (const t of tasks) {
      const predictivePct = t.published_count > 0
        ? Math.round((Number(t.published_predictive) / Number(t.published_count)) * 100)
        : 0;
      const flag = Number(t.published_count) === 0 ? "  ⚠️ SIN COBERTURA — bloquea full_sim" : "";
      console.log(
        `   Task ${t.task_number}: ${t.task_title} — publicadas: ${t.published_count} ` +
        `(draft: ${t.draft_count}, en revisión: ${t.in_review_count}, % predictive: ${predictivePct}%)${flag}`,
      );
      if (Number(t.published_count) === 0) zeroTasks.push(`${tasks[0].domain_name} / Task ${t.task_number}`);
    }

    totalPublished += domainPublished;
    console.log("");
  }

  console.log(`--- Total banco publicado: ${totalPublished} / objetivo ${TARGET_BANK_SIZE} ---`);
  if (zeroTasks.length > 0) {
    console.log(`\n⚠️  ${zeroTasks.length} tarea(s) sin ninguna pregunta publicada — un examen full_sim NO puede generarse hasta cubrirlas:`);
    zeroTasks.forEach((t) => console.log(`   - ${t}`));
  } else {
    console.log("\n✓ Las 26 tareas ECO tienen al menos 1 pregunta publicada.");
  }
}

main();
