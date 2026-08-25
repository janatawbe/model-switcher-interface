// Handles chat requests, streaming responses back to the client as newline-delimited JSON.
import { Router } from "express";
import { streamMessage } from "../services/aiService.js";
import { ApiError } from "../types/ai.js";
import { validateChatRequest } from "../validation.js";

export const chatRouter = Router();

// Route -> AI service -> OpenRouter. This handler never talks to
// OpenRouter itself -- it only validates the request and relays delta
// chunks as they arrive.
//
// The response is one JSON object per line (newline-delimited, not a
// single JSON body): {"type":"chunk","content":...} for each fragment,
// then either {"type":"done"} or {"type":"error",...}. Nothing is ever
// buffered and flushed as a whole -- each chunk is written to the client
// as soon as streamMessage's callback fires.
//
// Headers are only switched to the streaming content type once the first
// chunk actually arrives (see headerSet below). Until then, res.headersSent
// is still false, so a failure that happens before any content ever
// arrives (rate limit, model unavailable, auth, etc.) falls through to
// next(error) and produces the exact same JSON error response this route
// always has -- existing frontend error handling doesn't need to know
// streaming exists at all for that path.
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
      // Streaming had already started -- can't send a fresh HTTP error
      // status at this point, so the failure is reported as a terminal
      // event inside the still-open stream instead. The frontend treats
      // this identically to a pre-stream error (same code/message/resetAt
      // shape), it just arrives a different way.
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
