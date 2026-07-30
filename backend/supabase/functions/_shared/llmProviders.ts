// Abstracción mínima para poder dar de alta varios conectores LLM (Anthropic, OpenAI,
// cualquier proveedor compatible con la API de OpenAI) desde el panel de admin,
// sin acoplar el pipeline de generación a un único proveedor.

export interface LlmConnector {
  provider: string;       // 'anthropic' | 'openai' | 'openai_compatible' | 'google'
  model_id: string;
  api_base_url?: string | null;
  apiKey: string;         // ya desencriptada desde Vault, solo en memoria durante la llamada
}

export interface GenerationResult {
  text: string;
}

export async function callLlm(connector: LlmConnector, system: string, userPrompt: string): Promise<GenerationResult> {
  switch (connector.provider) {
    case "anthropic":
      return callAnthropic(connector, system, userPrompt);
    case "openai":
    case "openai_compatible":
      return callOpenAiCompatible(connector, system, userPrompt);
    default:
      throw new Error(`Proveedor no soportado: ${connector.provider}`);
  }
}

async function callAnthropic(connector: LlmConnector, system: string, userPrompt: string): Promise<GenerationResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": connector.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: connector.model_id,
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const textBlock = data.content?.find((b: any) => b.type === "text");
  if (!textBlock) throw new Error("Respuesta de Anthropic sin bloque de texto");
  return { text: textBlock.text };
}

async function callOpenAiCompatible(connector: LlmConnector, system: string, userPrompt: string): Promise<GenerationResult> {
  const baseUrl = connector.api_base_url ?? "https://api.openai.com/v1";
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${connector.apiKey}`,
    },
    body: JSON.stringify({
      model: connector.model_id,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1200,
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Respuesta sin contenido");
  return { text };
}
