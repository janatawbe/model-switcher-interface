import { resolveModel } from "../config/models.js";
import { ApiError, type AIServiceRequest, type ErrorCode, type ModelId } from "../types/ai.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

// OpenRouter is the ONLY AI gateway this backend talks to -- no separate
// Poolside/Google/NVIDIA provider clients. Everything OpenRouter-specific
// (the endpoint, headers, request/response shape, and its Server-Sent
// Events chunk format) is isolated to this one module so a future gateway
// swap only touches this file. Responses are always requested with
// stream: true and re-emitted to the route layer as plain delta strings --
// callers never see OpenRouter's own SSE/"choices[0].delta" shape.
type OpenRouterStreamChunk = {
  choices?: Array<{
    delta?: {
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

// Once streaming has actually started, a fixed total-duration timeout
// would unfairly kill a long-but-genuinely-still-arriving response. This
// instead resets on every chunk, so it only fires if the stream goes
// silent for this long -- a real stall, not just a long answer.
const STREAM_IDLE_TIMEOUT_MS = 30000;

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

async function callOpenRouter(
  apiKey: string,
  openRouterModel: string,
  messages: AIServiceRequest["messages"],
  maxTokens?: number,
  disableReasoning?: boolean,
) {
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
        // max_tokens/reasoning are omitted entirely for a normal chat reply
        // (undefined fields are dropped by JSON.stringify) -- only title
        // generation passes them, to keep that lightweight background
        // request cheap, short, and free of chain-of-thought preamble
        // (some models, e.g. Nemotron, otherwise spend the whole token
        // budget "thinking out loud" about how to write the title instead
        // of just answering with it).
        body: JSON.stringify({
          model: openRouterModel,
          messages,
          stream: true,
          max_tokens: maxTokens,
          ...(disableReasoning ? { reasoning: { enabled: false } } : {}),
        }),
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

// The backend's tsconfig has no "DOM" lib (it's Node-only), so the global
// ReadableStreamReadResult type from lib.dom.d.ts isn't available even
// though ReadableStreamDefaultReader itself is (declared separately by
// @types/node for the global fetch API) -- this just names the shape
// reader.read() actually resolves to.
type StreamReadResult = { done: boolean; value?: Uint8Array };

// Races a single reader.read() call against an idle timer -- if neither
// settles first, this is a stall (connection open, but nothing arriving).
async function readChunkWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<StreamReadResult> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error("STREAM_IDLE_TIMEOUT")), timeoutMs);
  });
  try {
    return await Promise.race([reader.read(), timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

// The application-level entry point: route handlers call this and never
// touch OpenRouter directly. Calls onDelta once per content fragment as it
// arrives (true incremental streaming, not a buffer-then-flush); resolves
// once OpenRouter signals the stream is complete. Throws the same ApiError
// categories as before for anything that goes wrong establishing the
// connection (classifyFailure/retry logic is unchanged, see
// callOpenRouter) -- the only new failure mode is a mid-stream stall,
// which reuses the existing generic AI_REQUEST_FAILED category rather
// than inventing a new one the frontend doesn't already know how to show.
export async function streamMessage(
  request: AIServiceRequest,
  onDelta: (delta: string) => void,
  maxTokens?: number,
  disableReasoning?: boolean,
): Promise<void> {
  const apiKey = getApiKey();
  const modelEntry = resolveModel(request.model);

  const response = await callOpenRouter(
    apiKey,
    modelEntry.openRouterModel,
    request.messages,
    maxTokens,
    disableReasoning,
  );

  const reader = response.body?.getReader();
  if (!reader) {
    throw new ApiError("INVALID_AI_RESPONSE", "Received an unreadable response from the model.", 502);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let sawAnyDelta = false;

  while (true) {
    let result: StreamReadResult;
    try {
      result = await readChunkWithTimeout(reader, STREAM_IDLE_TIMEOUT_MS);
    } catch {
      await reader.cancel().catch(() => {});
      console.error(
        `[aiService] stream from "${modelEntry.openRouterModel}" stalled -- no data for ${STREAM_IDLE_TIMEOUT_MS}ms`,
      );
      throw new ApiError("AI_REQUEST_FAILED", "The model stopped responding. Please try again.", 502);
    }

    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });

    // OpenRouter (like the OpenAI-compatible SSE format it mirrors) sends
    // one JSON payload per "data: ..." line; the final line is a literal
    // "data: [DONE]" sentinel rather than a JSON payload.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice("data:".length).trim();
      if (payload === "[DONE]") continue;

      let parsed: OpenRouterStreamChunk;
      try {
        parsed = JSON.parse(payload) as OpenRouterStreamChunk;
      } catch {
        continue; // a stray non-JSON SSE line (e.g. a keep-alive comment) -- not fatal, just skip it
      }

      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        sawAnyDelta = true;
        onDelta(delta);
      }
    }
  }

  if (!sawAnyDelta) {
    console.error(`[aiService] empty stream from "${modelEntry.openRouterModel}" -- no content deltas received`);
    throw new ApiError("INVALID_AI_RESPONSE", "The model returned an empty response.", 502);
  }
}

// Generous enough for a real question/reply to establish the topic, small
// enough to keep this lightweight -- a title doesn't need the model's
// entire (possibly long) answer, just enough of it to know what it's about.
const TITLE_CONTEXT_CHAR_LIMIT = 600;
// 3-7 words is comfortably under this even with a stray word or two of
// preamble the model ignores the instruction and adds anyway; kept a bit
// above the bare minimum since disableReasoning isn't guaranteed to be
// honored by every provider, and a truncated title is worse than a few
// extra tokens spent.
const TITLE_MAX_TOKENS = 30;

function truncateForTitleContext(text: string): string {
  return text.length > TITLE_CONTEXT_CHAR_LIMIT ? `${text.slice(0, TITLE_CONTEXT_CHAR_LIMIT)}…` : text;
}

// A small, separate, non-streaming-to-the-caller use of the same
// streamMessage/callOpenRouter plumbing real chat replies use -- reuses
// its retry/timeout/error-classification behavior as-is rather than
// duplicating any of it, just with a tight max_tokens cap and a
// single-purpose prompt. Uses the conversation's own model (never a
// different, separately-configured "title model"), consistent with "no
// separate provider integration." Callers are expected to treat any
// thrown ApiError as non-fatal to the conversation itself -- this only
// ever generates a title, never anything the user's chat depends on.
export async function generateConversationTitle(
  model: ModelId,
  userText: string,
  assistantText: string,
): Promise<string> {
  const prompt = [
    "Summarize the topic of this conversation as a short title, 3 to 7 words, in Title Case.",
    'It should read like something a person would naturally name the conversation (for example: "Fix React Authentication Bug" or "Paris Trip Planning").',
    'Do not use quotation marks. Do not end with punctuation. Do not include words like "Chat", "Conversation", or "Discussion" unless they are genuinely part of the topic.',
    "Do not mention the name of any AI model or assistant.",
    "Do not show any reasoning or thinking -- reply with only the title itself, nothing before or after it.",
    "",
    `User: ${truncateForTitleContext(userText)}`,
    `Assistant: ${truncateForTitleContext(assistantText)}`,
  ].join("\n");

  let title = "";
  await streamMessage(
    { model, messages: [{ role: "user", content: prompt }] },
    (delta) => {
      title += delta;
    },
    TITLE_MAX_TOKENS,
    true, // disableReasoning
  );

  return title.trim();
}
