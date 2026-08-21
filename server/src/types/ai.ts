// Our application's own model identities -- the same three IDs the frontend
// already uses (see src/components/ui/models.ts on the client side). The
// backend owns the mapping from these to real OpenRouter model IDs; the
// frontend never needs to know an OpenRouter ID exists.
export type ModelId = "gpt" | "gemma" | "nemotron";

export const MODEL_IDS: ModelId[] = ["gpt", "gemma", "nemotron"];

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

// What POST /api/chat returns on success.
export type ChatResponse = {
  message: ChatMessage & { model: ModelId };
};

// The AI service's own request/response contract -- deliberately identical
// in shape to ChatRequest/ChatResponse today, but kept as separate types
// since the route layer and the AI service layer are allowed to diverge
// later (e.g. the service gaining provider-specific options the route
// never needs to see).
export type AIServiceRequest = {
  model: ModelId;
  messages: ChatMessage[];
};

export type AIServiceResponse = {
  message: ChatMessage;
};

// AI_RATE_LIMITED / AI_PROVIDER_UNAVAILABLE / AI_AUTH_ERROR are the
// specific categories the AI service classifies a failed OpenRouter
// response into (by HTTP status); AI_REQUEST_FAILED remains the fallback
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
  | "AI_REQUEST_FAILED"
  | "INVALID_AI_RESPONSE"
  | "INTERNAL_ERROR";

export type AppError = {
  code: ErrorCode;
  message: string;
  status: number;
};

export class ApiError extends Error {
  code: ErrorCode;
  status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
