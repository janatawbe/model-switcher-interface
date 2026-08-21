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

// Bounds how long the UI can ever be stuck "thinking" -- without this, a
// stalled connection (TCP handshake completes but OpenRouter never
// responds) would hang this fetch, and therefore the frontend's loading
// state, indefinitely. 45s comfortably clears real observed response
// times for the slower reasoning-heavy free models while still giving up
// well before a user would reasonably wonder if the app is broken. Not
// retried -- a stall is a "something's actually wrong" signal, not the
// same "try again in a moment" case a 429 is.
const REQUEST_TIMEOUT_MS = 45000;

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
  if (status === 404) {
    // OpenRouter returns this when the requested model has no active
    // provider endpoint to route to right now -- distinct from a rate
    // limit (the request wasn't throttled, there's just nowhere to send
    // it) and not worth retrying, since a missing route doesn't resolve
    // itself in the few seconds a retry would wait.
    return {
      code: "AI_MODEL_UNAVAILABLE",
      message: "The selected model has no available provider right now.",
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
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

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
        signal: timeoutController.signal,
      });
    } catch (networkError) {
      const isTimeout = networkError instanceof Error && networkError.name === "AbortError";
      console.error(
        isTimeout
          ? `[aiService] request to OpenRouter for "${openRouterModel}" timed out after ${REQUEST_TIMEOUT_MS}ms`
          : `[aiService] network error calling OpenRouter for "${openRouterModel}":`,
        isTimeout ? "" : networkError,
      );
      throw new ApiError("AI_REQUEST_FAILED", "Unable to reach OpenRouter. Please try again.", 502);
    } finally {
      clearTimeout(timeoutId);
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
  const resetAt = lastStatus === 429 ? extractRateLimitResetAt(lastBody) : undefined;
  throw new ApiError(code, message, 502, resetAt);
}

// OpenRouter's free-tier daily quota (limit_source: "openrouter_free_tier_daily")
// echoes its own rate-limit headers back inside the error body, including a
// millisecond epoch reset time -- documented and referenced by name in the
// same error's own remedy_hint ("see X-RateLimit-Reset"), so it's a signal
// OpenRouter itself vouches for, not something we're inferring. Other 429
// causes (e.g. a specific provider's shared-pool throttling) don't carry
// this field, and in that case this deliberately returns undefined rather
// than guessing -- no Retry-After header exists on any OpenRouter response,
// confirmed by inspecting the raw response headers directly.
function extractRateLimitResetAt(body: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }

  const raw = (parsed as { error?: { metadata?: { headers?: Record<string, string> } } })?.error?.metadata?.headers?.[
    "X-RateLimit-Reset"
  ];
  if (!raw) return undefined;

  const resetMs = Number(raw);
  if (!Number.isFinite(resetMs) || resetMs <= Date.now()) return undefined;

  return new Date(resetMs).toISOString();
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
