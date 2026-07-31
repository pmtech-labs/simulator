/**
 * scripts/validate_questions.ts
 *
 * Etapa 2 del pipeline de contenido (ver prompt de Cowork, sección 2).
 * Recorre todas las preguntas en status='draft' y verifica su forma antes de
 * pasarlas a 'in_review' (cola de revisión humana por un PMP certificado).
 * No aprueba contenido por sí solo: solo descarta lo que no cumple el mínimo de calidad.
 *
 * Uso: npm run validate
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Términos que no deberían aparecer en el banco (marcas registradas fuera de contexto esperado,
// o frases que sugieran afiliación oficial con PMI).
const FORBIDDEN_PATTERNS = [
  /examen\s+oficial\s+de\s+pmi/i,
  /certificaci[oó]n\s+oficial\s+garantizada/i,
  /avalado\s+por\s+pmi/i,
];

const VALID_ERROR_TYPES = ["knowledge", "interpretation", "sequence", "role", "approach", "reading", "analysis", "time"];

interface ValidationResult {
  questionId: string;
  valid: boolean;
  issues: string[];
}

function validateQuestion(q: any): ValidationResult {
  const issues: string[] = [];

  if (!q.task_id) issues.push("Sin task_id asignado");
  if (!Array.isArray(q.options) || q.options.length < 2) issues.push("Menos de 2 opciones");
  if (!Array.isArray(q.correct_answer) || q.correct_answer.length === 0) {
    issues.push("correct_answer vacío");
  } else {
    const optionIds = new Set((q.options ?? []).map((o: any) => o.id));
    const allCorrectAreOptions = q.correct_answer.every((id: string) => optionIds.has(id));
    if (!allCorrectAreOptions) issues.push("correct_answer contiene ids que no están en options");

    for (const opt of q.options ?? []) {
      const isCorrectOption = q.correct_answer.includes(opt.id);
      if (!isCorrectOption) {
        if (!opt.error_type) issues.push(`Opción ${opt.id} (distractor) sin error_type`);
        else if (!VALID_ERROR_TYPES.includes(opt.error_type)) {
          issues.push(`Opción ${opt.id} con error_type inválido: ${opt.error_type}`);
        }
      }
    }
  }
  if (!q.explanation || q.explanation.trim().length < 20) issues.push("Explicación ausente o demasiado corta");
  if (!q.stem || q.stem.trim().length < 20) issues.push("Enunciado demasiado corto");
  if (q.stem && q.stem.length > 1200) issues.push("Enunciado sospechosamente largo (revisar posible copia literal de fuente)");

  const fullText = `${q.stem}\n${q.explanation}`;
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(fullText)) issues.push(`Contiene patrón no permitido: ${pattern}`);
  }

  return { questionId: q.id, valid: issues.length === 0, issues };
}

async function main() {
  const { data: drafts, error } = await supabase
    .from("questions")
    .select("id, stem, options, correct_answer, explanation, task_id")
    .eq("status", "draft");

  if (error) throw new Error(error.message);
  if (!drafts || drafts.length === 0) {
    console.log("No hay preguntas en draft para validar.");
    return;
  }

  let passed = 0;
  let failed = 0;

  for (const q of drafts) {
    const result = validateQuestion(q);
    if (result.valid) {
      await supabase.from("questions").update({ status: "in_review" }).eq("id", q.id);
      passed++;
    } else {
      console.warn(`✗ ${q.id} — ${result.issues.join("; ")}`);
      failed++;
      // No se borra: queda en 'draft' para revisión manual del motivo de fallo.
    }
  }

  console.log(`Validación completada. ${passed} pasaron a 'in_review', ${failed} quedaron en 'draft' con issues.`);
}

main();
