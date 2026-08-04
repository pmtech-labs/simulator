// Edge Function: generate_network_diagram_question
//
// POST -> genera preguntas de diagrama de red (CPM/PDM) de forma determinista:
//   1. La topología de la red y las duraciones se generan/randomizan por código.
//   2. El cálculo de ruta crítica (forward/backward pass, ES/EF/LS/LF, holgura) se hace
//      con un algoritmo determinista en este mismo archivo -- NUNCA se le pide a un LLM
//      que calcule ni verifique esta matemática. Los LLM son poco fiables haciendo
//      aritmética de grafos con varias ramas paralelas, y a diferencia de un enunciado
//      de texto, un error de cálculo aquí es difícil de detectar en revisión humana.
//   3. Los 4 distractores se construyen con plantillas deterministas ligadas al tipo de
//      error (reading/knowledge/analysis), usando los datos reales calculados -- nunca
//      texto libre de un LLM.
//   4. El SVG del diagrama se genera programáticamente a partir de los mismos datos.
//
// No se usa ningún conector LLM en esta función. generation_job_id queda NULL (mismo
// criterio que el contenido creado manualmente), porque no hay ningún modelo de IA
// involucrado en la generación de contenido ni de matemática.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { tagRowsFor } from "../_shared/tagMapping.ts";

interface ActivityDef {
  id: string;
  preds: string[];
}

// Topologías de red válidas (grafos acíclicos dirigidos). Las duraciones se randomizan
// en cada generación; la estructura de dependencias es fija por topología para
// garantizar que siempre sea una red válida y computable.
const TOPOLOGIES: ActivityDef[][] = [
  [
    { id: "A", preds: [] }, { id: "B", preds: [] },
    { id: "C", preds: ["A"] }, { id: "D", preds: ["A", "B"] },
    { id: "E", preds: ["C"] }, { id: "F", preds: ["D"] }, { id: "G", preds: ["D"] },
    { id: "H", preds: ["F", "G"] }, { id: "I", preds: ["E", "H"] },
  ],
  [
    { id: "A", preds: [] },
    { id: "B", preds: ["A"] }, { id: "C", preds: ["A"] },
    { id: "D", preds: ["B", "C"] },
    { id: "E", preds: ["D"] }, { id: "F", preds: ["E"] },
  ],
  [
    { id: "A", preds: [] },
    { id: "B", preds: ["A"] },
    { id: "C", preds: ["B"] }, { id: "D", preds: ["B"] }, { id: "G", preds: ["B"] },
    { id: "E", preds: ["C", "D"] },
    { id: "F", preds: ["E", "G"] },
  ],
];

const PROJECT_CONTEXTS = [
  "un hospital que implementa un nuevo sistema de registro electrónico",
  "una empresa que construye un puente peatonal",
  "un equipo que desarrolla una nueva aplicación móvil",
  "una planta industrial que renueva su línea de producción",
  "una universidad que digitaliza su proceso de matrícula",
  "una empresa de logística que abre un nuevo centro de distribución",
  "un ayuntamiento que renueva el alumbrado público de la ciudad",
  "una aerolínea que actualiza su sistema de check-in",
];

interface CpmNode {
  id: string;
  dur: number;
  preds: string[];
  succs: string[];
  es: number; ef: number; ls: number; lf: number; float: number;
}

function computeCpm(topology: ActivityDef[], durations: Record<string, number>): { nodes: Record<string, CpmNode>; projectDuration: number } {
  const nodes: Record<string, CpmNode> = {};
  for (const a of topology) {
    nodes[a.id] = { id: a.id, dur: durations[a.id], preds: a.preds, succs: [], es: 0, ef: 0, ls: 0, lf: 0, float: 0 };
  }
  for (const a of topology) {
    for (const p of a.preds) nodes[p].succs.push(a.id);
  }
  // Forward pass (requiere orden topológico; TOPOLOGIES está definido ya en orden topológico)
  for (const a of topology) {
    const n = nodes[a.id];
    n.es = a.preds.length === 0 ? 0 : Math.max(...a.preds.map((p) => nodes[p].ef));
    n.ef = n.es + n.dur;
  }
  const projectDuration = Math.max(...Object.values(nodes).map((n) => n.ef));
  // Backward pass (orden inverso)
  for (const a of [...topology].reverse()) {
    const n = nodes[a.id];
    n.lf = n.succs.length === 0 ? projectDuration : Math.min(...n.succs.map((s) => nodes[s].ls));
    n.ls = n.lf - n.dur;
    n.float = n.ls - n.es;
  }
  return { nodes, projectDuration };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Construye el SVG del diagrama de red (cajas PDM: ES|DUR|EF arriba, nombre en medio,
// LS|HOLGURA|LF abajo), coloreando en azul las actividades de la ruta crítica.
function buildNetworkSvg(topology: ActivityDef[], nodes: Record<string, CpmNode>): string {
  const W = 100, H = 50, colGap = 140, rowGap = 90;
  // Posición por "nivel" (columna = distancia topológica desde el inicio) y fila = índice dentro del nivel.
  const level: Record<string, number> = {};
  for (const a of topology) {
    level[a.id] = a.preds.length === 0 ? 0 : Math.max(...a.preds.map((p) => level[p])) + 1;
  }
  const byLevel: Record<number, string[]> = {};
  for (const a of topology) {
    (byLevel[level[a.id]] ??= []).push(a.id);
  }
  const pos: Record<string, { x: number; y: number }> = {};
  for (const [lvl, ids] of Object.entries(byLevel)) {
    ids.forEach((id, idx) => {
      pos[id] = { x: 20 + Number(lvl) * colGap, y: 20 + idx * rowGap };
    });
  }
  const maxY = Math.max(...Object.values(pos).map((p) => p.y)) + H + 20;
  const maxX = Math.max(...Object.values(pos).map((p) => p.x)) + W + 20;

  const box = (id: string) => {
    const n = nodes[id];
    const { x, y } = pos[id];
    const crit = n.float === 0;
    const fill = crit ? "#dbeafe" : "#f3f4f6";
    const stroke = crit ? "#2563eb" : "#9ca3af";
    const third = H / 3;
    return `<g>
      <rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
      <line x1="${x}" y1="${y + third}" x2="${x + W}" y2="${y + third}" stroke="${stroke}" stroke-width="1"/>
      <line x1="${x}" y1="${y + 2 * third}" x2="${x + W}" y2="${y + 2 * third}" stroke="${stroke}" stroke-width="1"/>
      <line x1="${x + W / 3}" y1="${y}" x2="${x + W / 3}" y2="${y + third}" stroke="${stroke}" stroke-width="0.75"/>
      <line x1="${x + 2 * W / 3}" y1="${y}" x2="${x + 2 * W / 3}" y2="${y + third}" stroke="${stroke}" stroke-width="0.75"/>
      <line x1="${x + W / 3}" y1="${y + 2 * third}" x2="${x + W / 3}" y2="${y + H}" stroke="${stroke}" stroke-width="0.75"/>
      <line x1="${x + 2 * W / 3}" y1="${y + 2 * third}" x2="${x + 2 * W / 3}" y2="${y + H}" stroke="${stroke}" stroke-width="0.75"/>
      <text x="${x + W / 6}" y="${y + third - 6}" font-size="9" text-anchor="middle">${n.es}</text>
      <text x="${x + W / 2}" y="${y + third - 6}" font-size="9" text-anchor="middle">${n.dur}</text>
      <text x="${x + 5 * W / 6}" y="${y + third - 6}" font-size="9" text-anchor="middle">${n.ef}</text>
      <text x="${x + W / 2}" y="${y + 2 * third - 6}" font-size="10" font-weight="bold" text-anchor="middle">${id}</text>
      <text x="${x + W / 6}" y="${y + H - 6}" font-size="9" text-anchor="middle">${n.ls}</text>
      <text x="${x + W / 2}" y="${y + H - 6}" font-size="9" text-anchor="middle">${n.float}</text>
      <text x="${x + 5 * W / 6}" y="${y + H - 6}" font-size="9" text-anchor="middle">${n.lf}</text>
    </g>`;
  };

  const arrow = (a: string, b: string) => {
    const pa = pos[a], pb = pos[b];
    const x1 = pa.x + W, y1 = pa.y + H / 2;
    const x2 = pb.x, y2 = pb.y + H / 2;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#6b7280" stroke-width="1.5" marker-end="url(#arrowhead)"/>`;
  };

  const boxes = topology.map((a) => box(a.id)).join("");
  const arrows = topology.flatMap((a) => a.preds.map((p) => arrow(p, a.id))).join("");

  return `<svg viewBox="0 0 ${maxX} ${maxY}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#6b7280"/></marker></defs>${boxes}${arrows}</svg>`;
}

interface GeneratedQuestion {
  stem: string;
  options: { id: string; text: string; error_type?: string }[];
  correct_answer: string[];
  explanation: string;
  difficulty: number;
  practicum_payload: { chart_type: string; diagram_svg: string };
}

function generateOne(): GeneratedQuestion {
  const topology = TOPOLOGIES[randInt(0, TOPOLOGIES.length - 1)];
  const durations: Record<string, number> = {};
  for (const a of topology) durations[a.id] = randInt(3, 15);

  const { nodes, projectDuration } = computeCpm(topology, durations);
  const ids = topology.map((a) => a.id);
  const context = PROJECT_CONTEXTS[randInt(0, PROJECT_CONTEXTS.length - 1)];

  const criticalIds = ids.filter((id) => nodes[id].float === 0);
  const nonCriticalIds = ids.filter((id) => nodes[id].float > 0);

  // 60% de las veces, la actividad objetivo es crítica; si no hay ninguna con holgura
  // (raro pero posible según la topología/duraciones), se cae en el caso crítico igual.
  const useCritical = nonCriticalIds.length === 0 || Math.random() < 0.6;

  let correctText: string;
  let distractors: { text: string; error_type: string }[];
  let delay: number;
  let target: string;

  if (useCritical) {
    target = criticalIds[randInt(0, criticalIds.length - 1)];
    delay = randInt(2, 8);
    const newDuration = projectDuration + delay;
    correctText = `El proyecto pasa a durar ${newDuration} días, porque ${target} forma parte de la ruta crítica (holgura total = 0).`;

    const otherCritical = criticalIds.filter((id) => id !== target);
    const analysisTarget = otherCritical.length > 0 ? otherCritical[randInt(0, otherCritical.length - 1)] : ids.find((id) => id !== target)!;

    distractors = [
      { text: `No afecta a la duración del proyecto porque ${target} tiene holgura positiva.`, error_type: "reading" },
      { text: `Solo afecta a las actividades no críticas del proyecto, no a su fecha de fin.`, error_type: "knowledge" },
      { text: `El proyecto se retrasa, pero la actividad ${analysisTarget} deja de ser crítica y absorbe parte del retraso.`, error_type: "analysis" },
    ];
  } else {
    target = nonCriticalIds[randInt(0, nonCriticalIds.length - 1)];
    const float = nodes[target].float;
    const noImpact = float >= 2 && Math.random() < 0.5;

    if (noImpact) {
      delay = randInt(1, float - 1 || 1);
      const newFloat = float - delay;
      correctText = `El proyecto sigue durando ${projectDuration} días: la actividad ${target} tenía ${float} día(s) de holgura, así que un retraso de ${delay} día(s) la deja con ${newFloat} día(s) de holgura restante, sin afectar la fecha de fin del proyecto ni volverse crítica.`;
      distractors = [
        { text: `El proyecto pasa a durar ${projectDuration + delay} días porque cualquier retraso afecta directamente la fecha de fin.`, error_type: "reading" },
        { text: `La actividad ${target} pasa a formar parte de la ruta crítica de inmediato.`, error_type: "knowledge" },
        { text: `El proyecto termina antes de lo previsto porque ${target} tenía holgura disponible sin usar.`, error_type: "analysis" },
      ];
    } else {
      delay = float + randInt(1, 6);
      const overrun = delay - float;
      const newDuration = projectDuration + overrun;
      correctText = `El proyecto se retrasa ${overrun} día(s), pasando a durar ${newDuration} días: la actividad ${target} solo tenía ${float} día(s) de holgura, así que el retraso de ${delay} días la agota y además añade ${overrun} día(s) que sí impactan la fecha de fin del proyecto.`;
      distractors = [
        { text: `El proyecto se retrasa exactamente ${delay} días, la misma magnitud que el retraso de ${target}.`, error_type: "reading" },
        { text: `No afecta al proyecto porque ${target} no está en la ruta crítica original.`, error_type: "knowledge" },
        { text: `El retraso se compensa automáticamente ajustando la ruta crítica sin impacto en la fecha de fin.`, error_type: "analysis" },
      ];
    }
  }

  const letters = shuffle(["A", "B", "C", "D"]);
  const optionEntries = [
    { text: correctText, error_type: undefined as string | undefined },
    ...distractors,
  ];
  const options = optionEntries.map((opt, idx) => ({
    id: letters[idx],
    text: opt.text,
    ...(opt.error_type ? { error_type: opt.error_type } : {}),
  }));
  const correctLetter = letters[0];

  const stem = `En ${context}, se ha modelado el proyecto con el diagrama de red que se muestra a continuación, usando el método de diagramación por precedencia (PDM), con las fechas de inicio y fin tempranas y tardías ya calculadas. Si la actividad ${target} se retrasa ${delay} día(s), ¿qué ocurre?`;

  const explanation = `${correctText} ` +
    distractors.map((d) => `La opción con el texto "${d.text.slice(0, 40)}..." es incorrecta (error de tipo ${d.error_type}).`).join(" ");

  const diagramSvg = buildNetworkSvg(topology, nodes);
  const difficulty = randInt(3, 5); // interpretar diagramas de red es inherentemente medio-alto

  return {
    stem,
    options,
    correct_answer: [correctLetter],
    explanation,
    difficulty,
    practicum_payload: { chart_type: "network_diagram", diagram_svg: diagramSvg },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);
  if (!(await requireAdmin(user.id))) return errorResponse("No autorizado (requiere rol admin)", 403);

  const body: { task_id: string; count?: number; approach?: string } = await req.json();
  if (!body.task_id) return errorResponse("Falta el campo task_id", 400);

  const count = Math.min(Math.max(body.count ?? 5, 1), 30);
  const admin = getSupabaseAdmin();

  const { data: task, error: taskErr } = await admin.from("eco_tasks").select("id, eco_domains(code)").eq("id", body.task_id).single();
  if (taskErr || !task) return errorResponse("Tarea ECO no encontrada", 404);

  const insertedIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const q = generateOne();
    const { data, error } = await admin
      .from("questions")
      .insert({
        item_type: "standalone",
        format: "graphic_based",
        stem: q.stem,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        task_id: body.task_id,
        approach: body.approach ?? "predictive",
        difficulty: q.difficulty,
        process_group: "monitoring_control", // interpretar CPM/ruta crítica es inherentemente de seguimiento
        performance_domain: "cronograma", // diagrama de red = cronograma por naturaleza del contenido
        status: "draft", // sigue pasando por revisión humana, aunque la matemática esté garantizada
        practicum_payload: q.practicum_payload,
        generation_job_id: null, // no interviene ningún LLM/conector -- igual que el contenido manual
      })
      .select("id")
      .single();
    if (!error && data) {
      insertedIds.push(data.id);
      // Nueva taxonomía del PO (question_tags): sin IA, todos los valores son fijos
      // o derivados directamente (igual que el resto de columnas de este generador).
      await admin.from("question_tags").insert(tagRowsFor(data.id, {
        domainCode: (task as any).eco_domains?.code ?? "process",
        approach: body.approach ?? "predictive",
        processGroup: "monitoring_control",
        performanceDomain: "cronograma",
        themes: [],
        isCase: false,
        format: "graphic_based",
      }));
    }
  }

  return jsonResponse({ generated: insertedIds.length, requested: count, question_ids: insertedIds });
});
