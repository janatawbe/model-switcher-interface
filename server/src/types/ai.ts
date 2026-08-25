// Shared backend types: model identities, chat request shapes, and the ApiError class.
// Our application's own model identities -- the same three IDs the frontend
// already uses (see src/components/ui/models.ts on the client side). The
// backend owns the mapping from these to real OpenRouter model IDs; the
// frontend never needs to know an OpenRouter ID exists.
export type ModelId = "minimax-m3" | "nemotron" | "laguna";

export const MODEL_IDS: ModelId[] = ["minimax-m3", "nemotron", "laguna"];

// This app id slot has had two earlier occupants -- "gemma" (replaced by
// Inkling), then "inkling" (replaced by MiniMax M3) -- and a conversation
// created during either era can still send a chat/title request carrying
// its old id; nothing anywhere rewrites a user's already-persisted
// localStorage data. Normalizing both aliases here (before validation, see
// validation.ts) means an old conversation from either era keeps working
// exactly as before instead of suddenly failing with UNSUPPORTED_MODEL.
const LEGACY_MODEL_ID_ALIASES: Record<string, ModelId> = { gemma: "minimax-m3", inkling: "minimax-m3" };

export function normalizeModelId(value: unknown): unknown {
  return typeof value === "string" ? (LEGACY_MODEL_ID_ALIASES[value] ?? value) : value;
}

export function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && (MODEL_IDS as string[]).includes(value);
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// What the frontend sends to POST /api/chat.
export type ChatRequest = {
  model: ModelId;
  messages: ChatMessage[];
};

// The AI service's own request contract -- deliberately identical in shape
// to ChatRequest today, but kept as a separate type since the route layer
// and the AI service layer are allowed to diverge later (e.g. the service
// gaining provider-specific options the route never needs to see).
// POST /api/chat's success response is a stream of newline-delimited JSON
// chunks rather than a single body, so there's no corresponding response
// type here -- see routes/chat.ts and aiService.streamMessage.
export type AIServiceRequest = {
  model: ModelId;
  messages: ChatMessage[];
};

// AI_RATE_LIMITED / AI_PROVIDER_UNAVAILABLE / AI_AUTH_ERROR /
// AI_MODEL_UNAVAILABLE are the specific categories the AI service
// classifies a failed OpenRouter response into (by HTTP status);
// AI_REQUEST_FAILED remains the fallback
// for anything that doesn't fit one of those (network failures, unusual
// statuses) -- the frontend maps each of these to a distinct, honest
// user-facing message and only falls back to a generic one for this last
// bucket. Applies uniformly to every model, since the classification is
// driven by the response OpenRouter itself returns, not by which model
// was requested.
export type ErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_MODEL"
  | "MISSING_API_KEY"
  | "AI_RATE_LIMITED"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_AUTH_ERROR"
  | "AI_MODEL_UNAVAILABLE"
  | "AI_REQUEST_FAILED"
  | "INVALID_AI_RESPONSE"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  // ISO-8601 timestamp for when a rate limit is expected to clear. Only
  // ever set for AI_RATE_LIMITED, and only when OpenRouter itself supplied
  // a reset time -- never estimated or guessed client- or server-side.
  resetAt?: string;

  constructor(code: ErrorCode, message: string, status: number, resetAt?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.resetAt = resetAt;
  }
}
