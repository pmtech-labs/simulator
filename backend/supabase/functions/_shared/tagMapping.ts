// Traduce los valores internos que ya usan los generadores (domain_code, approach,
// process_group, performance_domain, format/item_type, themes) a los códigos EXACTOS
// de la nueva taxonomía del PO (Excel "Etiquetas_preguntas_simulador_PMP"), y
// construye las filas listas para insertar en question_tags.
//
// AE (Área de Enfoque) y DD (Dominio de Desempeño) admiten varias etiquetas por
// pregunta, pero la GENERACIÓN nueva sigue targeteando una sola por rotación
// ponderada (igual que hasta ahora) -- el multi-etiquetado real (detectar que una
// pregunta ya escrita toca más de un área/dominio) es tarea de reclassify_question_tags
// sobre contenido existente, no algo que se fuerce en el momento de generar.

const DOMAIN_TO_DO: Record<string, string> = {
  people: "DOPE",
  process: "DOPR",
  business_environment: "DOEN",
};

const APPROACH_TO_CI: Record<string, string> = {
  predictive: "CIPR",
  agile: "CIAH",
  hybrid: "CIAH",
};

const PROCESS_GROUP_TO_AE: Record<string, string> = {
  initiation: "AEIN",
  planning: "AEPL",
  execution: "AEEJ",
  monitoring_control: "AEMC",
  closing: "AECI",
};

const PERFORMANCE_DOMAIN_TO_DD: Record<string, string> = {
  gobernanza: "DDGO",
  alcance: "DDAL",
  cronograma: "DDCR",
  finanzas: "DDFI",
  recursos: "DDRE",
  riesgos: "DDRI",
  interesados: "DDIN",
};

const THEME_TO_NT: Record<string, string> = {
  entrega_valor: "NTEV",
  sostenibilidad: "NTSO",
  ia: "NTIA",
};

export interface TagInputs {
  domainCode: string; // people | process | business_environment
  approach: string; // predictive | agile | hybrid
  processGroup: string; // initiation | planning | execution | monitoring_control | closing
  performanceDomain: string; // gobernanza | alcance | ...
  themes: string[]; // entrega_valor | sostenibilidad | ia (0-3)
  isCase: boolean; // item_type === 'case_child'
  format: string; // mc_single | mc_multi | matching | enhanced_matching | hotspot | pulldown | graphic_based
}

export function buildTagCodes(inputs: TagInputs): string[] {
  const codes: string[] = [];

  const doCode = DOMAIN_TO_DO[inputs.domainCode];
  if (doCode) codes.push(doCode);

  const ciCode = APPROACH_TO_CI[inputs.approach];
  if (ciCode) codes.push(ciCode);

  const aeCode = PROCESS_GROUP_TO_AE[inputs.processGroup];
  if (aeCode) codes.push(aeCode);

  const ddCode = PERFORMANCE_DOMAIN_TO_DD[inputs.performanceDomain];
  if (ddCode) codes.push(ddCode);

  // FO (Formato): caso siempre FOCE independientemente del format interno;
  // mc_single/mc_multi mapean directo; el resto (matching/enhanced_matching/
  // hotspot/pulldown/graphic_based) son todos "Interactivas" (FOIN) en esta
  // categoría más amplia del PO.
  if (inputs.isCase) {
    codes.push("FOCE");
  } else if (inputs.format === "mc_single") {
    codes.push("FOTU");
  } else if (inputs.format === "mc_multi") {
    codes.push("FOTM");
  } else {
    codes.push("FOIN");
  }

  for (const theme of inputs.themes) {
    const ntCode = THEME_TO_NT[theme];
    if (ntCode) codes.push(ntCode);
  }

  return codes;
}

export function tagRowsFor(questionId: string, inputs: TagInputs): { question_id: string; tag_code: string }[] {
  return buildTagCodes(inputs).map((tag_code) => ({ question_id: questionId, tag_code }));
}
