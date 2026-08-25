// Shared backend types: model ids, chat request shapes, and ApiError.
// App-level model ids; the backend maps these to real OpenRouter model ids.
export type ModelId = "minimax-m3" | "nemotron" | "laguna";

export const MODEL_IDS: ModelId[] = ["minimax-m3", "nemotron", "laguna"];

// Old model ids from replaced models; keeps existing conversations working.
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

// Request shape passed into the AI service layer.
export type AIServiceRequest = {
  model: ModelId;
  messages: ChatMessage[];
};

// Error categories the frontend maps to user-facing messages.
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
  // When a rate limit clears; only set if OpenRouter provides it.
  resetAt?: string;

  constructor(code: ErrorCode, message: string, status: number, resetAt?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.resetAt = resetAt;
  }
}
