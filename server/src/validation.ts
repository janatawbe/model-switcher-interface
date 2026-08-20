import { ApiError, isModelId, type ChatMessage, type ChatRequest } from "./types/ai.js";

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

// Never trust the request body -- validates shape and content field by
// field and throws a normalized ApiError (never a raw stack trace) on the
// first problem found.
export function validateChatRequest(body: unknown): ChatRequest {
  if (!isPlainObject(body)) {
    throw new ApiError("INVALID_REQUEST", "Request body must be a JSON object.", 400);
  }

  const { model, messages } = body;

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
