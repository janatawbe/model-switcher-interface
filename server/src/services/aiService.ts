// Handles OpenRouter requests, streaming, retries, and error handling.
import { resolveModel } from "../config/models.js";
import { ApiError, type AIServiceRequest, type ErrorCode, type ModelId } from "../types/ai.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

// Shape of one streamed chunk from OpenRouter's chat completions API.
type OpenRouterStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

// Retries rate-limited requests a few times before giving up.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Prevents a request from hanging indefinitely if OpenRouter never responds.
const REQUEST_TIMEOUT_MS = 45000;

// Resets on each chunk, so only a silent stream is treated as a stall.
const STREAM_IDLE_TIMEOUT_MS = 30000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Turns an OpenRouter HTTP status into a user-facing error category.
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
    // No active provider for this model right now; not worth retrying.
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
        // max_tokens/reasoning only apply to title generation, kept short and cheap.
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
    // Log the real upstream error server-side; the client gets a generic message.
    console.error(
      `[aiService] OpenRouter request failed for "${openRouterModel}" (attempt ${attempt}/${MAX_ATTEMPTS}): ${lastStatus} ${response.statusText}\n${lastBody}`,
    );

    // Only rate limits are worth retrying automatically.
    const canRetry = response.status === 429 && attempt < MAX_ATTEMPTS;
    if (!canRetry) break;
    await sleep(RETRY_DELAY_MS * attempt);
  }

  const { code, message } = classifyFailure(lastStatus);
  const resetAt = lastStatus === 429 ? extractRateLimitResetAt(lastBody) : undefined;
  throw new ApiError(code, message, 502, resetAt);
}

// Reads the rate-limit reset time OpenRouter reports, if any.
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

// Shape of a stream reader's read() result (no DOM lib on the backend).
type StreamReadResult = { done: boolean; value?: Uint8Array };

// Reads one chunk, or throws if the stream stays silent too long.
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

// Streams a chat completion, calling onDelta as each chunk arrives.
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

    // Each SSE line holds one JSON payload; the last line is a "[DONE]" sentinel.
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
        continue; // skip malformed lines
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

// Enough context to capture the topic without sending the full reply.
const TITLE_CONTEXT_CHAR_LIMIT = 600;
// Small budget for a short title, with room for stray extra words.
const TITLE_MAX_TOKENS = 30;

function truncateForTitleContext(text: string): string {
  return text.length > TITLE_CONTEXT_CHAR_LIMIT ? `${text.slice(0, TITLE_CONTEXT_CHAR_LIMIT)}…` : text;
}

// Generates a short conversation title using the same model and pipeline.
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
