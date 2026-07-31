/**
 * scripts/generate_questions.ts
 *
 * Etapa 1 del pipeline de contenido (ver prompt de Cowork, sección 2).
 * Genera borradores de preguntas con Claude a partir de una tarea ECO 2026 concreta
 * (+ sus enablers) y las inserta en `questions` con status='draft'.
 *
 * IMPORTANTE:
 *  - Fuente de contexto: SIEMPRE la tarea + enablers del ECO. Nunca se le pide al modelo
 *    que cite o resuma el PMBOK como texto — el ECO define qué se pregunta.
 *  - Nunca se generan referencias a marcas registradas de PMI fuera de lo esperado
 *    (el prompt lo prohíbe explícitamente).
 *  - Todo lo generado aquí queda en 'draft'. Nada llega al usuario final sin pasar
 *    por scripts/validate_questions.ts y la revisión humana (status in_review -> approved -> published).
 *
 * Uso:
 *   TASK_ID=<uuid> APPROACH=predictive FORMAT=mc_single COUNT=10 npm run generate
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const QuestionDraftSchema = z.object({
  stem: z.string().min(20),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
    error_type: z.enum(["knowledge", "interpretation", "sequence", "role", "approach", "reading", "analysis", "time"]).optional(),
  })).min(2),
  correct_answer: z.array(z.string()).min(1),
  explanation: z.string().min(30),
  difficulty: z.number().int().min(1).max(5),
}).refine((draft) => {
  // Cada distractor (opción no correcta) debe llevar error_type asignado.
  return draft.options.every((o) => draft.correct_answer.includes(o.id) || !!o.error_type);
}, { message: "Cada distractor debe llevar error_type asignado" });

type QuestionDraft = z.infer<typeof QuestionDraftSchema>;

async function fetchTaskContext(taskId: string) {
  const { data: task, error } = await supabase
    .from("eco_tasks")
    .select("id, title, domain_id, eco_domains(code, name), eco_enablers(description)")
    .eq("id", taskId)
    .single();

  if (error || !task) throw new Error(`No se encontró la tarea ECO ${taskId}: ${error?.message}`);
  return task;
}

function buildSystemPrompt() {
  return `Eres un redactor experto de exámenes de certificación de project management, familiarizado con el
Exam Content Outline (ECO) 2026 de PMI. Tu única fuente de verdad para generar preguntas es la tarea y los
enablers del ECO que se te proporcionan — NUNCA cites literalmente ni parafrasees de cerca el PMBOK u otro
material protegido, y nunca menciones marcas registradas de PMI fuera del contexto normal de un examen de
práctica no oficial. Genera escenarios realistas de gestión de proyectos que evalúen juicio situacional,
no memorización de definiciones.

DISEÑO DE DISTRACTORES (obligatorio): cada opción incorrecta debe ser plausible pero fallar por una razón
concreta, clasificada en uno de estos 8 tipos: "sequence" (acción válida pero no la primera que corresponde),
"role" (la decisión es de otra persona/rol), "approach" (lógica predictiva en contexto ágil o viceversa),
"analysis" (actúa sin considerar toda la información), "knowledge" (concepto incorrecto), "interpretation"
(malinterpreta la situación), "reading" (ignora un dato decisivo del enunciado), "time" (urgencia/tiempo
mal gestionado). Asigna "error_type" a CADA opción incorrecta; la correcta no lo lleva.

CALIDAD DE LA EXPLICACIÓN (obligatoria): debe indicar la mejor respuesta y el dato decisivo del enunciado,
el razonamiento/principio evaluado, y por qué cada otra opción falla conectándolo con su error_type.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni backticks, con esta forma exacta:
{
  "stem": "...",
  "options": [{"id":"A","text":"...","error_type":"sequence"}, {"id":"B","text":"..."}, {"id":"C","text":"...","error_type":"role"}, {"id":"D","text":"...","error_type":"analysis"}],
  "correct_answer": ["B"],
  "explanation": "...",
  "difficulty": 3
}`;
}

function buildUserPrompt(task: any, approach: string, format: string) {
  const enablers = (task.eco_enablers ?? []).map((e: any) => `- ${e.description}`).join("\n");
  return `Dominio ECO: ${task.eco_domains.name}
Tarea: ${task.title}
Enablers de referencia:
${enablers}

Enfoque de gestión de proyectos a aplicar en el escenario: ${approach} (predictive | agile | hybrid)
Formato de la pregunta: ${format}

Genera UNA pregunta de examen tipo PMP en español (neutro, apto España/LATAM), situacional, que evalúe
esta tarea y al menos uno de sus enablers. La pregunta debe poder responderse correctamente aplicando
buen juicio de dirección de proyectos, no solo memoria. Incluye una explicación (rationale) que justifique
por qué la respuesta correcta lo es y por qué las demás no.`;
}

async function generateOne(task: any, approach: string, format: string): Promise<QuestionDraft> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildUserPrompt(task, approach, format) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Respuesta sin bloque de texto");

  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return QuestionDraftSchema.parse(parsed);
}

async function insertDraft(task: any, approach: string, format: string, draft: QuestionDraft) {
  const { error } = await supabase.from("questions").insert({
    item_type: "standalone",
    format,
    stem: draft.stem,
    options: draft.options,
    correct_answer: draft.correct_answer,
    explanation: draft.explanation,
    task_id: task.id,
    approach,
    difficulty: draft.difficulty,
    status: "draft",
  });
  if (error) throw new Error(`Error insertando draft: ${error.message}`);
}

async function main() {
  const taskId = process.env.TASK_ID;
  const approach = process.env.APPROACH ?? "predictive";
  const format = process.env.FORMAT ?? "mc_single";
  const count = Number(process.env.COUNT ?? 5);

  if (!taskId) {
    console.error("Falta TASK_ID. Uso: TASK_ID=<uuid> APPROACH=predictive FORMAT=mc_single COUNT=10 npm run generate");
    process.exit(1);
  }

  const task = await fetchTaskContext(taskId);
  console.log(`Generando ${count} preguntas para: [${task.eco_domains.name}] ${task.title} (${approach}/${format})`);

  let created = 0;
  for (let i = 0; i < count; i++) {
    try {
      const draft = await generateOne(task, approach, format);
      await insertDraft(task, approach, format, draft);
      created++;
      console.log(`  ✓ ${i + 1}/${count} generada e insertada como draft`);
    } catch (err) {
      console.error(`  ✗ ${i + 1}/${count} falló:`, (err as Error).message);
    }
  }

  console.log(`Listo. ${created}/${count} preguntas creadas en status='draft'. Pasan ahora por validate_questions.ts.`);
}

main();
