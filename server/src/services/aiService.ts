import { resolveModel } from "../config/models.js";
import { ApiError, type AIServiceRequest, type AIServiceResponse, type ErrorCode } from "../types/ai.js";

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

// Free OpenRouter models sit behind a shared upstream capacity pool per
// provider (e.g. all apps hitting Google AI Studio's free tier at once) --
// a 429 there is a transient "try again in a moment" condition, not a
// broken model or a bad request, and applies identically to whichever
// model happens to be popular at that instant. One short, bounded retry
// covers that case for every model through this single service, so no
// model needs special-casing.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Turns OpenRouter's raw HTTP status into one of our own error categories,
// with a message that's honest about what actually happened without
// leaking any provider/technical detail. Driven purely by the status
// code OpenRouter returned, so it applies identically no matter which
// model was requested.
function classifyFailure(status: number): { code: ErrorCode; message: string } {
  if (status === 429) {
    return {
      code: "AI_RATE_LIMITED",
      message: "The model's provider is currently rate-limiting requests. Please try again in a moment.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      code: "AI_AUTH_ERROR",
      message: "There's a configuration issue reaching the model provider.",
    };
  }
  if (status >= 500) {
    return {
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "The model's provider is temporarily unavailable or experiencing high demand.",
    };
  }
  return {
    code: "AI_REQUEST_FAILED",
    message: "Unable to get a response from the selected model.",
  };
}

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

async function callOpenRouter(apiKey: string, openRouterModel: string, messages: AIServiceRequest["messages"]) {
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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
        body: JSON.stringify({ model: openRouterModel, messages }),
      });
    } catch (networkError) {
      console.error(`[aiService] network error calling OpenRouter for "${openRouterModel}":`, networkError);
      throw new ApiError("AI_REQUEST_FAILED", "Unable to reach OpenRouter. Please try again.", 502);
    }

    if (response.ok) return response;

    lastStatus = response.status;
    lastBody = await response.text().catch(() => "<unreadable response body>");
    // Log the real upstream status/body server-side on every attempt --
    // this is what actually gets hidden behind the generic client-facing
    // message, and is the detail needed to diagnose model-specific issues.
    console.error(
      `[aiService] OpenRouter request failed for "${openRouterModel}" (attempt ${attempt}/${MAX_ATTEMPTS}): ${lastStatus} ${response.statusText}\n${lastBody}`,
    );

    // Only a rate limit is worth retrying automatically -- it's the one
    // case OpenRouter itself frames as "temporary, try again shortly".
    // Auth/config problems and hard provider outages won't resolve by
    // immediately hammering the same request again.
    const canRetry = response.status === 429 && attempt < MAX_ATTEMPTS;
    if (!canRetry) break;
    await sleep(RETRY_DELAY_MS * attempt);
  }

  const { code, message } = classifyFailure(lastStatus);
  throw new ApiError(code, message, 502);
}

// The application-level entry point: route handlers call this and never
// touch OpenRouter directly.
export async function sendMessage(request: AIServiceRequest): Promise<AIServiceResponse> {
  const apiKey = getApiKey();
  const modelEntry = resolveModel(request.model);

  const response = await callOpenRouter(apiKey, modelEntry.openRouterModel, request.messages);

  let payload: OpenRouterChatResponse;
  try {
    payload = (await response.json()) as OpenRouterChatResponse;
  } catch (parseError) {
    console.error(`[aiService] unreadable response body from "${modelEntry.openRouterModel}":`, parseError);
    throw new ApiError("INVALID_AI_RESPONSE", "Received an unreadable response from the model.", 502);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    console.error(`[aiService] empty/invalid content from "${modelEntry.openRouterModel}":`, JSON.stringify(payload));
    throw new ApiError("INVALID_AI_RESPONSE", "The model returned an empty response.", 502);
  }

  return {
    message: { role: "assistant", content },
  };
}
