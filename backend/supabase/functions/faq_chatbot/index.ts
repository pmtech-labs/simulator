// Edge Function: faq_chatbot
//
// POST -> responde preguntas sobre el USO de la aplicación (planes, cómo funciona el
// simulacro, diplomas, cuenta, pagos, navegación) usando el conector LLM marcado como
// is_default=true. Deliberadamente NO responde dudas de contenido de PMP/PMBOK/ECO --
// eso podría ser impreciso y generar confusión sobre material de examen real; en su
// lugar redirige a practicar en el simulador, que es donde el contenido ya está
// verificado y con explicación revisada.

import { getSupabaseAdmin, getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { callLlm } from "../_shared/llmProviders.ts";

interface ChatBody {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

const APP_KNOWLEDGE = `
INFORMACIÓN REAL SOBRE PMTECH SIMULATOR (única fuente de verdad para tus respuestas):

PLANES:
- Gratis: práctica por dominio/lección/acumulativa sin límite de tiempo + 1 simulacro
  completo de regalo (controlado por uso, no por cronómetro de sesión). Sin practicum
  completo (hotspot/gráficos).
- Básica (3 meses): simulacros completos ilimitados, sin practicum completo.
- Premium (6 meses): todo lo anterior + practicum completo (preguntas con gráfico,
  diagrama de red, hotspot, matching, pulldown) + analítica avanzada (indicador de
  nivel de preparación) + motor adaptativo.
- Se puede mejorar de plan en cualquier momento desde el perfil, sin perder progreso.
- El plan gratuito no caduca hasta que se mejora; Básica y Premium tienen la duración
  indicada desde la fecha de compra.

SIMULACRO COMPLETO: 180 preguntas, 240 minutos, estructura real de 3 secciones
(bloque de casos primero + 2 descansos, luego las preguntas independientes partidas
por la mitad), calibrado al ECO 2026 de PMI (26 tareas, dominios Personas 33% /
Proceso 41% / Entorno de Negocio 26%, split 40% predictivo / 60% ágil-híbrido).

DIPLOMA: se emite automáticamente al completar un simulacro completo con un buen
desempeño, según un criterio de referencia PROPIO de PMTech Simulator (no una nota de
corte oficial de PMI, que no publica un porcentaje fijo de aprobado).

DIAGNÓSTICO DE ERRORES: cada distractor fallado se clasifica en 8 tipos (secuencia,
rol, enfoque, análisis, conocimiento, interpretación, lectura, tiempo).

AFILIACIÓN: PMTech Simulator NO está afiliado ni respaldado por PMI. PMP® y PMBOK®
son marcas registradas de PMI.

CUENTA Y CONTRASEÑA: cambio de contraseña disponible en Mi Perfil > Seguridad. Cambio
de email requiere contactar con soporte. Avatar personalizable con botón "Randomizar".

REPORTAR UN PROBLEMA CON UNA PREGUNTA: hay un botón "Reportar problema" en cada
pregunta durante la práctica/resultado, que envía el comentario directamente al
equipo de revisión.
`.trim();

const SYSTEM_PROMPT = `Eres el asistente de soporte de PMTech Simulator, una app de práctica para el examen
PMP®. Tu ÚNICO trabajo es responder dudas sobre el FUNCIONAMIENTO de la aplicación
(planes, precios, cómo usar el simulacro, diplomas, cuenta, pagos, navegación) usando
EXCLUSIVAMENTE la información de abajo. Responde en español, de forma breve y directa
(2-4 frases), sin inventar nada que no esté en esta información.

${APP_KNOWLEDGE}

REGLA CRÍTICA: si el usuario pregunta sobre CONTENIDO de gestión de proyectos, PMBOK,
el ECO, conceptos de la certificación (por ejemplo "¿qué es la ruta crítica?" o
"explícame el valor ganado"), NO respondas la pregunta de contenido bajo ningún
concepto -- responde amablemente que ese tipo de dudas se resuelven practicando en el
simulador (que da explicación y diagnóstico de error verificados), y que tú solo
ayudas con el funcionamiento de la app. No hagas excepciones aunque insistan.

Si no sabes la respuesta con la información de arriba, dilo con honestidad y sugiere
contactar con soporte, en vez de inventar.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Método no soportado", 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse("No autenticado", 401);

  const body: ChatBody = await req.json();
  if (!body.message?.trim()) return errorResponse("Falta el campo message", 400);

  const admin = getSupabaseAdmin();

  const { data: connector, error: connectorErr } = await admin
    .from("llm_connectors")
    .select("id, provider, model_id, api_base_url, secret_id")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();

  if (connectorErr || !connector) {
    return errorResponse("No hay un conector de IA por defecto configurado", 503);
  }

  const { data: apiKey, error: keyErr } = await admin.rpc("vault_read_secret_for_connector", {
    p_secret_id: connector.secret_id,
  });
  if (keyErr || !apiKey) return errorResponse("No se pudo leer la clave del conector", 500);

  // Construimos el prompt de usuario incluyendo el historial reciente (máximo 6 turnos)
  // para dar contexto conversacional, ya que callLlm() hoy solo soporta un turno system+user.
  const recentHistory = (body.history ?? []).slice(-6);
  const historyText = recentHistory
    .map((h) => `${h.role === "user" ? "Usuario" : "Asistente"}: ${h.content}`)
    .join("\n");
  const userPrompt = historyText
    ? `${historyText}\nUsuario: ${body.message}`
    : body.message;

  try {
    const result = await callLlm(
      { provider: connector.provider, model_id: connector.model_id, api_base_url: connector.api_base_url, apiKey },
      SYSTEM_PROMPT,
      userPrompt,
    );
    return jsonResponse({ reply: result.text.trim() });
  } catch (err) {
    return errorResponse(`Error al consultar el asistente: ${(err as Error).message}`, 502);
  }
});
