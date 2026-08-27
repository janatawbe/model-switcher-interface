// Handles OpenRouter requests, streaming, retries, tool calls, and error handling.
import { resolveModel } from "../config/models.js";
import { performWebSearch, type WebSearchResult } from "./searchService.js";
import { ApiError, type AIServiceRequest, type ErrorCode, type ModelId } from "../types/ai.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

// Shape of one streamed chunk from OpenRouter's chat completions API.
// tool_calls arrive as accumulable fragments: the first fragment for an index
// usually carries id/name, later ones for the same index carry more of the
// (partial) JSON arguments string.
type OpenRouterStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
};

// A chat message in OpenAI/OpenRouter's tool-calling message schema.
// Wider than ChatMessage so the tool-calling loop can add assistant
// tool_calls messages and tool-result messages alongside plain turns.
type ORToolCallSpec = { id: string; type: "function"; function: { name: string; arguments: string } };
type ORMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ORToolCallSpec[];
  tool_call_id?: string;
};

type ORTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
};

const WEB_SEARCH_TOOL_NAME = "web_search";

const WEB_SEARCH_TOOLS: ORTool[] = [
  {
    type: "function",
    function: {
      name: WEB_SEARCH_TOOL_NAME,
      description:
        "Search the web for current, recent, or up-to-date information that may be beyond your training data -- for example news, prices, recent product releases, current events, or sports results. Only use this when the question genuinely needs current information; do not use it for general or timeless questions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
        },
        required: ["query"],
      },
    },
  },
];

// Rebuilt per request so "today" is always the real current date, not the
// date the server process happened to start on.
function buildWebSearchSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
  `Today's actual date is ${today}. Use this as the real current date for all reasoning below -- your own training data may be older than this and may not reflect it.`,
  "You have a web_search tool. You MUST call it before answering whenever the question depends on information that could have changed since your training cutoff. This includes, but is not limited to:",
  "- the latest, current, or most recent version/release of something",
  "- current products or product releases",
  "- current prices (stocks, crypto, products, etc.)",
  "- current events or news",
  "- current sports results",
  "- current rankings or leaderboards",
  "- current political office holders or other current public-affairs information",
  "- anything the user explicitly asks you to search, check, or verify online",
  "For stable, general, or timeless knowledge (how something works, historical facts, well-established concepts), answer directly from your own knowledge -- do not search unnecessarily.",
  "If you are unsure whether information may be outdated, prefer calling web_search over guessing.",
  "For questions involving \"latest\", \"current\", \"today\", \"recent\", \"upcoming\", release dates, event dates, prices, or rankings, always compare any dates found in the web search results against today's actual date above before answering:",
  "- Never call something \"upcoming\" if its release or event date is on or before today's actual date.",
  "- If a result says something was scheduled for a date that has already passed, verify whether it actually happened or released rather than assuming it is still upcoming.",
  "- When asked for the latest released/current item, distinguish clearly between: (1) already released or occurred, (2) announced but not yet released, and (3) cancelled, delayed, or postponed.",
  "- Prioritize what is true as of today's actual date, not merely what a search result's wording says -- reason over the dates and facts returned, don't just repeat a result's wording.",
  "- If the search results contain conflicting dates or an unclear release status, search again before answering rather than guessing.",
  "- Never invent a release date, and never claim something is upcoming without checking its date against today's actual date.",
  "When you use web search results in your answer, end your reply with a section titled exactly \"Sources:\" followed by a Markdown bullet list, each item formatted exactly as [Source title](https://actual-url.com) -- for example:\nSources:\n- [Example Site](https://example.com)\n- [Another Source](https://another-example.com)",
  "Only include URLs that were actually returned by web_search in this conversation -- never invent, guess, or reuse a URL from memory.",
  "Do not use any other citation style -- no bracketed reference markers like 【1†L1-L4】, no footnote numbers, no inline citation tags. Markdown links in the Sources section are the only citation format to use.",
  "Keep the Sources section concise: 2 to 5 of the most relevant sources that actually support the claims in your answer, not every result returned.",
  "If you did not use web_search for this answer, do not add a Sources section.",
  "If a web search fails or returns nothing useful, say so plainly and answer from your own knowledge if you can, making clear that current information could not be verified.",
  ].join("\n");
}

// Caps how many rounds of tool calls a single reply can make before it's forced to answer directly.
const MAX_TOOL_ITERATIONS = 3;

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
  messages: ORMessage[],
  maxTokens?: number,
  disableReasoning?: boolean,
  tools?: ORTool[],
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
          ...(tools ? { tools, tool_choice: "auto" } : {}),
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

// One tool call as fully accumulated from streamed fragments.
type ToolCall = { id: string; name: string; arguments: string };

// Reads one turn of a tool-aware stream: forwards content deltas as they
// arrive (so normal replies stream exactly like streamMessage does) while
// separately accumulating any tool_calls fragments for the caller to act on.
async function consumeTurn(
  response: Response,
  openRouterModel: string,
  onDelta: (delta: string) => void,
): Promise<{ toolCalls: ToolCall[]; sawAnyDelta: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new ApiError("INVALID_AI_RESPONSE", "Received an unreadable response from the model.", 502);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let sawAnyDelta = false;
  const toolCallsByIndex = new Map<number, { id?: string; name?: string; arguments: string }>();

  while (true) {
    let result: StreamReadResult;
    try {
      result = await readChunkWithTimeout(reader, STREAM_IDLE_TIMEOUT_MS);
    } catch {
      await reader.cancel().catch(() => {});
      console.error(
        `[aiService] stream from "${openRouterModel}" stalled -- no data for ${STREAM_IDLE_TIMEOUT_MS}ms`,
      );
      throw new ApiError("AI_REQUEST_FAILED", "The model stopped responding. Please try again.", 502);
    }

    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });

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

      const delta = parsed.choices?.[0]?.delta;
      if (!delta) continue;

      if (typeof delta.content === "string" && delta.content.length > 0) {
        sawAnyDelta = true;
        onDelta(delta.content);
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const fragment of delta.tool_calls) {
          const index = fragment.index ?? 0;
          const existing = toolCallsByIndex.get(index) ?? { arguments: "" };
          if (fragment.id) existing.id = fragment.id;
          if (fragment.function?.name) existing.name = fragment.function.name;
          if (fragment.function?.arguments) existing.arguments += fragment.function.arguments;
          toolCallsByIndex.set(index, existing);
        }
      }
    }
  }

  const toolCalls: ToolCall[] = Array.from(toolCallsByIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([index, call]) => ({ id: call.id ?? `${WEB_SEARCH_TOOL_NAME}_${index}`, name: call.name ?? "", arguments: call.arguments }))
    .filter((call) => call.name.length > 0);

  return { toolCalls, sawAnyDelta };
}

// Runs a tool call and returns its result as a string for a "tool" message.
// Never throws -- failures become a safe message the model can react to.
async function executeToolCall(
  call: ToolCall,
  searchFn: (query: string) => Promise<WebSearchResult[]>,
): Promise<string> {
  if (call.name !== WEB_SEARCH_TOOL_NAME) {
    return JSON.stringify({ error: `Unknown tool "${call.name}".` });
  }

  let query: string;
  try {
    const parsedArgs = JSON.parse(call.arguments || "{}") as { query?: unknown };
    if (typeof parsedArgs.query !== "string" || parsedArgs.query.trim().length === 0) {
      return JSON.stringify({ error: 'The "query" argument must be a non-empty string.' });
    }
    query = parsedArgs.query.trim();
  } catch {
    return JSON.stringify({ error: "Could not parse the tool call arguments." });
  }

  try {
    const results = await searchFn(query);
    return results.length > 0
      ? JSON.stringify({ results })
      : JSON.stringify({ results: [], note: "No web results were found for this query." });
  } catch (error) {
    console.error(`[aiService] web_search tool failed for query "${query}":`, error);
    return JSON.stringify({
      error:
        "Web search is currently unavailable. Answer using existing knowledge and say that current information could not be verified.",
    });
  }
}

// Streams a chat reply with access to the web_search tool. Content deltas
// stream live exactly like streamMessage; when the model requests a search,
// it's executed server-side and the result fed back for up to
// MAX_TOOL_ITERATIONS rounds before a final answer is forced.
export async function streamChatWithTools(
  request: AIServiceRequest,
  onDelta: (delta: string) => void,
  onStatus?: (status: string) => void,
  searchFn: (query: string) => Promise<WebSearchResult[]> = performWebSearch,
): Promise<void> {
  const apiKey = getApiKey();
  const modelEntry = resolveModel(request.model);

  const orMessages: ORMessage[] = [
    { role: "system", content: buildWebSearchSystemPrompt() },
    ...request.messages.map((message): ORMessage => ({ role: message.role, content: message.content })),
  ];

  for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS + 1; iteration++) {
    const includeTools = iteration <= MAX_TOOL_ITERATIONS;

    let response: Response;
    try {
      response = await callOpenRouter(
        apiKey,
        modelEntry.openRouterModel,
        orMessages,
        undefined,
        undefined,
        includeTools ? WEB_SEARCH_TOOLS : undefined,
      );
    } catch (error) {
      // Some models/providers reject an unfamiliar `tools` field outright;
      // fall back to a plain request once so the user still gets an answer.
      if (iteration === 1 && includeTools && error instanceof ApiError && error.code === "AI_REQUEST_FAILED") {
        console.error(
          `[aiService] "${modelEntry.openRouterModel}" rejected the tool-enabled request; retrying without tools.`,
        );
        response = await callOpenRouter(apiKey, modelEntry.openRouterModel, orMessages, undefined, undefined, undefined);
      } else {
        throw error;
      }
    }

    const { toolCalls, sawAnyDelta } = await consumeTurn(response, modelEntry.openRouterModel, onDelta);

    if (toolCalls.length === 0) {
      if (!sawAnyDelta) {
        console.error(`[aiService] empty stream from "${modelEntry.openRouterModel}" -- no content deltas received`);
        throw new ApiError("INVALID_AI_RESPONSE", "The model returned an empty response.", 502);
      }
      return;
    }

    orMessages.push({
      role: "assistant",
      content: null,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    });

    onStatus?.("Searching the web...");

    for (const call of toolCalls) {
      const resultText = await executeToolCall(call, searchFn);
      orMessages.push({ role: "tool", tool_call_id: call.id, content: resultText });
    }
  }

  // Unreachable in practice: the forced final iteration omits tools, so the
  // model cannot request another call and the loop above always returns.
  throw new ApiError("AI_REQUEST_FAILED", "The model could not produce a final answer.", 502);
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
