// Edge Function: admin_generate_hotspot_question
//
// POST -> genera preguntas hotspot usando PLANTILLAS DE DIAGRAMA FIJAS (código, no
// IA): una rejilla 2x2 (para clasificaciones tipo "poder/interés") y una línea
// temporal de 5 zonas (para los 5 grupos de proceso). La IA SOLO aporta el escenario
// y las etiquetas de texto de cada zona -- nunca las coordenadas ni el SVG, que
// siempre se generan por código a partir de una plantilla ya verificada visualmente.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLlm } from "../_shared/llmProviders.ts";
import { tagRowsFor } from "../_shared/tagMapping.ts";

interface CreateHotspotBody {
  connector_id: string;
  task_ids: string[];
  count_requested: number;
  template?: "grid_2x2" | "timeline_5"; // por defecto alterna entre ambas
}

const PROCESS_GROUPS = ["initiation", "planning", "execution", "monitoring_control", "closing"] as const;
// Actualización del PO: Áreas de Enfoque pasan de 20/20/20/20/20 a 10/30/20/30/10.
const WEIGHTED_PROCESS_GROUPS = [
  "initiation",
  "planning", "planning", "planning",
  "execution", "execution",
  "monitoring_control", "monitoring_control", "monitoring_control",
  "closing",
] as const;
const PERFORMANCE_DOMAINS = ["gobernanza", "alcance", "cronograma", "finanzas", "recursos", "riesgos", "interesados"] as const;
type Theme = "entrega_valor" | "sostenibilidad" | "ia";
function pickThemes(): Theme[] {
  const themes: Theme[] = [];
  if (Math.random() < 0.5) themes.push("entrega_valor");
  if (Math.random() < 0.1) themes.push("sostenibilidad");
  if (Math.random() < 0.1) themes.push("ia");
  return themes;
}

function buildSystemPrompt(template: string, zonesCount: number): string {
  const shape = template === "grid_2x2" ? "una rejilla 2x2 (4 cuadrantes)" : "una línea temporal de 5 etapas secuenciales";
  return `Eres un redactor experto de exámenes de certificación de project management, familiarizado con el
Exam Content Outline (ECO) 2026 de PMI. NUNCA cites literalmente ni parafrasees de cerca el PMBOK u otro
material protegido.

Tu tarea es generar el contenido para una pregunta de tipo "señala y haz clic" (hotspot) sobre ${shape}.
Debes aportar SOLO texto: el escenario, las ${zonesCount} etiquetas de las zonas (cortas, 2-4 palabras cada
una) y cuál es la zona correcta -- el diagrama en sí ya está prediseñado, tú no lo dibujas.

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
{
  "stem": "Escenario situacional + instrucción de hacer clic en la zona correcta",
  "zone_labels": ["etiqueta 1", "etiqueta 2", ...],  // exactamente ${zonesCount}, cortas
  "correct_zone_index": 0,  // índice (0-based) de la zona correcta dentro de zone_labels
  "explanation": "Por qué esa zona es la correcta y por qué las demás no lo son"
}`;
}

function buildUserPrompt(task: any, targetThemes: Theme[]): string {
  const enablers = (task.eco_enablers ?? []).map((e: any) => `- ${e.description}`).join("\n");
  const themeLine = targetThemes.length > 0
    ? `\n\nTemática(s) a integrar si es natural: ${targetThemes.join(", ")}`
    : "";
  return `Dominio ECO: ${task.eco_domains.name}
Tarea: ${task.title}
Enablers de referencia:
${enablers}${themeLine}

Genera un escenario situacional relacionado con esta tarea donde el candidato deba identificar la zona
correcta de un diagrama de clasificación.`;
}

// --- Plantillas de diagrama (SVG generado por código, coordenadas ya verificadas) ---

function buildGrid2x2Svg(labels: string[], correctIdx: number): string {
  const positions = [
    { x: 20, y: 20 }, { x: 210, y: 20 },
    { x: 20, y: 150 }, { x: 210, y: 150 },
  ];
  const W = 190, H = 130;
  const boxes = labels.map((label, idx) => {
    const { x, y } = positions[idx];
    const isCorrect = idx === correctIdx;
    const fill = isCorrect ? "#dbeafe" : "#f3f4f6";
    const stroke = isCorrect ? "#2563eb" : "#9ca3af";
    // Envolver la etiqueta en 2 líneas si es larga
    const words = label.split(" ");
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(" ");
    const line2 = words.slice(mid).join(" ");
    return `<g>
      <rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
      <text x="${x + W / 2}" y="${y + H / 2 - 6}" font-size="12" font-weight="bold" text-anchor="middle">${line1}</text>
      <text x="${x + W / 2}" y="${y + H / 2 + 12}" font-size="12" font-weight="bold" text-anchor="middle">${line2}</text>
    </g>`;
  }).join("");
  return `<svg viewBox="0 0 420 300" xmlns="http://www.w3.org/2000/svg">${boxes}</svg>`;
}

function buildTimeline5Svg(labels: string[], correctIdx: number): string {
  const W = 120, H = 70, gap = 20;
  const boxes = labels.map((label, idx) => {
    const x = 10 + idx * (W + gap);
    const y = 60;
    const isCorrect = idx === correctIdx;
    const fill = isCorrect ? "#dbeafe" : "#f3f4f6";
    const stroke = isCorrect ? "#2563eb" : "#9ca3af";
    const words = label.split(" ");
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(" ");
    const line2 = words.slice(mid).join(" ");
    const arrow = idx < labels.length - 1
      ? `<line x1="${x + W}" y1="${y + H / 2}" x2="${x + W + gap}" y2="${y + H / 2}" stroke="#6b7280" stroke-width="1.5" marker-end="url(#arrowhead)"/>`
      : "";
    return `<g>
      <rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
      <text x="${x + W / 2}" y="${y + H / 2 - 4}" font-size="10" font-weight="bold" text-anchor="middle">${line1}</text>
      <text x="${x + W / 2}" y="${y + H / 2 + 12}" font-size="10" font-weight="bold" text-anchor="middle">${line2}</text>
    </g>${arrow}`;
  }).join("");
  const totalWidth = 10 + labels.length * (W + gap);
  return `<svg viewBox="0 0 ${totalWidth} 200" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#6b7280"/></marker></defs>${boxes}</svg>`;
}

function buildHotspots(template: string, labels: string[], correctIdx: number): any[] {
  if (template === "grid_2x2") {
    const zones = [
      { x_pct: 4.8, y_pct: 6.7, w_pct: 45.2, h_pct: 43.3 },
      { x_pct: 50, y_pct: 6.7, w_pct: 45.2, h_pct: 43.3 },
      { x_pct: 4.8, y_pct: 50, w_pct: 45.2, h_pct: 43.3 },
      { x_pct: 50, y_pct: 50, w_pct: 45.2, h_pct: 43.3 },
    ];
    return labels.map((label, idx) => ({
      id: `zone${idx + 1}`, label, correct: idx === correctIdx, ...zones[idx],
    }));
  }
  // timeline_5: posiciones proporcionales sobre un ancho total variable
  const W = 120, H = 70, gap = 20;
  const totalWidth = 10 + labels.length * (W + gap);
  return labels.map((label, idx) => {
    const x = 10 + idx * (W + gap);
    return {
      id: `zone${idx + 1}`, label, correct: idx === correctIdx,
      x_pct: (x / totalWidth) * 100, y_pct: (60 / 200) * 100,
      w_pct: (W / totalWidth) * 100, h_pct: (H / 200) * 100,
    };
  });
}

function repairUnescapedQuotes(text: string): string {
  let result = "";
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) { result += ch; escapeNext = false; continue; }
    if (ch === "\\") { result += ch; escapeNext = true; continue; }
    if (ch === '"') {
      if (!inString) { inString = true; result += ch; }
      else {
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        const next = text[j];
        if (next === ":" || next === "," || next === "}" || next === "]" || j >= text.length) {
          inString = false; result += ch;
        } else { result += '\\"'; }
      }
      continue;
    }
    result += ch;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const admin = getSupabaseAdmin();
  const body: CreateHotspotBody = await req.json();
  if (!body.connector_id || !body.task_ids?.length || !body.count_requested) {
    return errorResponse("Faltan campos requeridos (connector_id, task_ids, count_requested)", 400);
  }

  const { data: connectorRow, error: connectorErr } = await admin
    .from("llm_connectors")
    .select("id, provider, model_id, api_base_url, secret_id, is_active")
    .eq("id", body.connector_id)
    .single();
  if (connectorErr || !connectorRow) return errorResponse("Conector no encontrado", 404);
  if (!connectorRow.is_active) return errorResponse("El conector está desactivado", 409);

  const { data: apiKey, error: keyErr } = await admin.rpc("vault_read_secret_for_connector", {
    p_secret_id: connectorRow.secret_id,
  });
  if (keyErr || !apiKey) return errorResponse("No se pudo leer la API key del conector", 500);

  let generated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < body.count_requested; i++) {
    const taskId = body.task_ids[i % body.task_ids.length];
    const template = body.template ?? (i % 2 === 0 ? "grid_2x2" : "timeline_5");
    const zonesCount = template === "grid_2x2" ? 4 : 5;
    const targetProcessGroup = WEIGHTED_PROCESS_GROUPS[i % WEIGHTED_PROCESS_GROUPS.length];
    const targetPerformanceDomain = PERFORMANCE_DOMAINS[i % PERFORMANCE_DOMAINS.length];
    const targetThemes = pickThemes();

    const { data: task } = await admin
      .from("eco_tasks")
      .select("id, title, eco_domains(name, code), eco_enablers(description)")
      .eq("id", taskId)
      .single();
    if (!task) { failed++; errors.push(`Ítem ${i + 1}: tarea no encontrada`); continue; }

    try {
      const result = await callLlm(
        { provider: connectorRow.provider, model_id: connectorRow.model_id, api_base_url: connectorRow.api_base_url, apiKey },
        buildSystemPrompt(template, zonesCount),
        buildUserPrompt(task, targetThemes),
        1200,
      );

      const cleaned = result.text.replace(/```json|```/g, "").trim();
      let draft: any;
      try {
        draft = JSON.parse(cleaned);
      } catch {
        try {
          draft = JSON.parse(repairUnescapedQuotes(cleaned));
        } catch (parseErr) {
          failed++;
          errors.push(`Ítem ${i + 1}: JSON inválido (${(parseErr as Error).message})`);
          continue;
        }
      }

      if (
        !draft.stem || !Array.isArray(draft.zone_labels) || draft.zone_labels.length !== zonesCount ||
        typeof draft.correct_zone_index !== "number" || draft.correct_zone_index < 0 || draft.correct_zone_index >= zonesCount ||
        !draft.explanation
      ) {
        failed++;
        errors.push(`Ítem ${i + 1}: estructura inválida`);
        continue;
      }

      const diagramSvg = template === "grid_2x2"
        ? buildGrid2x2Svg(draft.zone_labels, draft.correct_zone_index)
        : buildTimeline5Svg(draft.zone_labels, draft.correct_zone_index);
      const hotspots = buildHotspots(template, draft.zone_labels, draft.correct_zone_index);
      const correctZoneId = hotspots[draft.correct_zone_index].id;

      const options = hotspots.map((h: any) => ({ id: h.id, text: h.label }));

      const { data: insertedQuestion } = await admin.from("questions").insert({
        item_type: "standalone",
        format: "hotspot",
        stem: draft.stem,
        options,
        correct_answer: [correctZoneId],
        explanation: draft.explanation,
        task_id: taskId,
        approach: "predictive",
        difficulty: 2 + Math.floor(Math.random() * 2),
        process_group: targetProcessGroup,
        performance_domain: targetPerformanceDomain,
        focus_tags: targetThemes,
        status: "draft",
        practicum_payload: { diagram_svg: diagramSvg, hotspots },
      }).select("id").single();

      if (insertedQuestion) {
        await admin.from("question_tags").insert(tagRowsFor(insertedQuestion.id, {
          domainCode: task.eco_domains.code,
          approach: "predictive",
          processGroup: targetProcessGroup,
          performanceDomain: targetPerformanceDomain,
          themes: targetThemes,
          isCase: false,
          format: "hotspot",
        }));
      }
      generated++;
    } catch (err) {
      failed++;
      errors.push(`Ítem ${i + 1}: ${(err as Error).message}`);
    }
  }

  return jsonResponse({ generated, failed, errors: errors.slice(0, 20) });
});
