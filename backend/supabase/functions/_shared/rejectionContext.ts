// Consulta los motivos de rechazo reales (question_rejections) para inyectarlos como
// contexto en los prompts de generación -- así el modelo evita repetir los mismos
// errores que ya llevaron al PO a retirar preguntas anteriores durante su revisión.
//
// Combina dos fuentes:
//  - Rechazos de la MISMA tarea ECO (más específico, hasta 3): patrones de contenido
//    concretos de esa tarea.
//  - Rechazos RECIENTES en general (hasta 5, de cualquier tarea): patrones de estilo o
//    calidad que no dependen de la tarea concreta (ej. "distractor demasiado obvio").
//
// Si no hay ningún rechazo todavía (banco nuevo, o nadie ha retirado nada aún), la
// función devuelve una cadena vacía y el prompt queda exactamente igual que antes --
// no se inventa contexto donde no lo hay.

export async function buildRejectionContext(admin: any, taskId: string): Promise<string> {
  const [taskSpecific, recentGeneral] = await Promise.all([
    admin
      .from("question_rejections")
      .select("reason, stem_snapshot")
      .eq("task_id", taskId)
      .order("rejected_at", { ascending: false })
      .limit(3),
    admin
      .from("question_rejections")
      .select("reason")
      .order("rejected_at", { ascending: false })
      .limit(5),
  ]);

  const taskRows = taskSpecific?.data ?? [];
  const generalRows = recentGeneral?.data ?? [];

  if (taskRows.length === 0 && generalRows.length === 0) return "";

  const parts: string[] = [];

  if (taskRows.length > 0) {
    const lines = taskRows
      .map((r: any) => `- "${String(r.stem_snapshot).slice(0, 100)}..." fue retirada porque: ${r.reason}`)
      .join("\n");
    parts.push(
      `Preguntas ANTERIORES de esta MISMA tarea que el revisor retiró por no tener calidad suficiente (evita repetir estos mismos problemas):\n${lines}`,
    );
  }

  if (generalRows.length > 0) {
    const reasons = [...new Set(generalRows.map((r: any) => r.reason))].join("; ");
    parts.push(`Motivos recientes por los que se han retirado otras preguntas del banco (patrones generales a evitar): ${reasons}`);
  }

  return `\n\nCALIDAD -- APRENDE DE RECHAZOS ANTERIORES (obligatorio tenerlo en cuenta):\n${parts.join("\n\n")}`;
}
