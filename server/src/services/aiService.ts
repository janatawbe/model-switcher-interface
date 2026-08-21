import { resolveModel } from "../config/models.js";
import { ApiError, type AIServiceRequest, type AIServiceResponse } from "../types/ai.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

// OpenRouter is the ONLY AI gateway this backend talks to -- no separate
// OpenAI/Google/NVIDIA provider clients. Everything OpenRouter-specific
// (the endpoint, headers, request/response shape) is isolated to this one
// module so a future gateway swap only touches this file.
type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
  }>;
};

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new ApiError(
      "MISSING_API_KEY",
      "The server is not configured with an OpenRouter API key.",
      500,
    );
  }
  return key;
}

// The application-level entry point: route handlers call this and never
// touch OpenRouter directly.
export async function sendMessage(request: AIServiceRequest): Promise<AIServiceResponse> {
  const apiKey = getApiKey();
  const modelEntry = resolveModel(request.model);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/janatawbe/model-switcher-interface",
        "X-Title": "AI Model Switcher",
      },
      body: JSON.stringify({
        model: modelEntry.openRouterModel,
        messages: request.messages,
      }),
    });
  } catch {
    throw new ApiError(
      "AI_REQUEST_FAILED",
      "Unable to reach OpenRouter. Please try again.",
      502,
    );
  }

  if (!response.ok) {
    throw new ApiError(
      "AI_REQUEST_FAILED",
      "Unable to get a response from the selected model.",
      502,
    );
  }

  let payload: OpenRouterChatResponse;
  try {
    payload = (await response.json()) as OpenRouterChatResponse;
  } catch {
    throw new ApiError("INVALID_AI_RESPONSE", "Received an unreadable response from the model.", 502);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new ApiError("INVALID_AI_RESPONSE", "The model returned an empty response.", 502);
  }

  return {
    message: { role: "assistant", content },
  };
}
