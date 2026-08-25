// Validates and normalizes incoming chat/title request bodies.
import { ApiError, isModelId, normalizeModelId, type ChatMessage, type ChatRequest, type ModelId } from "./types/ai.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateMessage(value: unknown, index: number): ChatMessage {
  if (!isPlainObject(value)) {
    throw new ApiError("INVALID_REQUEST", `messages[${index}] must be an object.`, 400);
  }
  const { role, content } = value;
  if (role !== "user" && role !== "assistant") {
    throw new ApiError(
      "INVALID_REQUEST",
      `messages[${index}].role must be "user" or "assistant".`,
      400,
    );
  }
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new ApiError("INVALID_REQUEST", `messages[${index}].content must be a non-empty string.`, 400);
  }
  return { role, content };
}

// Validates each field and throws a clean error on the first problem.
export function validateChatRequest(body: unknown): ChatRequest {
  if (!isPlainObject(body)) {
    throw new ApiError("INVALID_REQUEST", "Request body must be a JSON object.", 400);
  }

  const { messages } = body;
  const model = normalizeModelId(body.model);

  if (typeof model !== "string" || model.length === 0) {
    throw new ApiError("INVALID_REQUEST", "Request must include a \"model\" string.", 400);
  }
  if (!isModelId(model)) {
    throw new ApiError("UNSUPPORTED_MODEL", `Model "${model}" is not supported.`, 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ApiError("INVALID_REQUEST", "Request must include a non-empty \"messages\" array.", 400);
  }

  const validatedMessages = messages.map((message, index) => validateMessage(message, index));

  return { model, messages: validatedMessages };
}

export type TitleRequest = {
  model: ModelId;
  userMessage: string;
  assistantMessage: string;
};

export function validateTitleRequest(body: unknown): TitleRequest {
  if (!isPlainObject(body)) {
    throw new ApiError("INVALID_REQUEST", "Request body must be a JSON object.", 400);
  }

  const { userMessage, assistantMessage } = body;
  const model = normalizeModelId(body.model);

  if (typeof model !== "string" || !isModelId(model)) {
    throw new ApiError("UNSUPPORTED_MODEL", `Model "${String(model)}" is not supported.`, 400);
  }
  if (typeof userMessage !== "string" || userMessage.trim().length === 0) {
    throw new ApiError("INVALID_REQUEST", "Request must include a non-empty \"userMessage\" string.", 400);
  }
  if (typeof assistantMessage !== "string" || assistantMessage.trim().length === 0) {
    throw new ApiError("INVALID_REQUEST", "Request must include a non-empty \"assistantMessage\" string.", 400);
  }

  return { model, userMessage, assistantMessage };
}
