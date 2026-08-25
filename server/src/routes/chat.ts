// Handles chat requests and streams responses to the client.
import { Router } from "express";
import { streamMessage } from "../services/aiService.js";
import { ApiError } from "../types/ai.js";
import { validateChatRequest } from "../validation.js";

export const chatRouter = Router();

// Validates the request, then relays each streamed chunk as newline-delimited JSON.
// Headers switch to streaming mode only once the first chunk arrives, so an
// early failure still returns a normal JSON error response.
chatRouter.post("/chat", async (req, res, next) => {
  try {
    const chatRequest = validateChatRequest(req.body);
    let headerSet = false;

    await streamMessage(chatRequest, (delta) => {
      if (!headerSet) {
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-cache");
        headerSet = true;
      }
      res.write(`${JSON.stringify({ type: "chunk", content: delta, model: chatRequest.model })}\n`);
    });

    res.write(`${JSON.stringify({ type: "done" })}\n`);
    res.end();
  } catch (error) {
    if (res.headersSent) {
      // Streaming has started, so send the error through the active stream.
      const apiError = error instanceof ApiError ? error : null;
      res.write(
        `${JSON.stringify({
          type: "error",
          code: apiError?.code ?? "AI_REQUEST_FAILED",
          message: apiError?.message ?? "Something went wrong reaching the model.",
          ...(apiError?.resetAt ? { resetAt: apiError.resetAt } : {}),
        })}\n`,
      );
      res.end();
      return;
    }
    next(error);
  }
});
