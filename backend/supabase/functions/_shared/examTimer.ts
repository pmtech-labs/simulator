// Cálculo del tiempo restante del reloj GLOBAL único del examen (R6/R7): un solo
// temporizador de 240 min compartido entre los 3 bloques, que se congela durante un
// descanso y solo "recupera" hasta 600s por descanso (el exceso sobre 10 min se
// descuenta solo, sin lógica adicional, porque nunca se le devuelve más de 600s).
export interface ExamTimerRow {
  time_limit_seconds: number | null;
  started_at: string | null;
  paused_at: string | null;
  break_extension_seconds: number | null;
}

export function computeRemainingSeconds(exam: ExamTimerRow): number | null {
  if (exam.time_limit_seconds == null || !exam.started_at) return null;

  const startedMs = new Date(exam.started_at).getTime();
  const extensionMs = (exam.break_extension_seconds ?? 0) * 1000;
  const limitMs = exam.time_limit_seconds * 1000;

  // Mientras está en descanso, el reloj queda congelado en el instante en que empezó
  // la pausa -- el tiempo que sigue transcurriendo del descanso NO consume el reloj
  // principal (hasta el límite de 600s por descanso, ya contabilizado aparte al
  // reanudar en break_extension_seconds).
  const nowMs = exam.paused_at ? new Date(exam.paused_at).getTime() : Date.now();

  const elapsedMs = nowMs - startedMs;
  const remainingMs = limitMs + extensionMs - elapsedMs;
  return Math.max(0, Math.round(remainingMs / 1000));
}
