import { Router } from "express";
import { generateConversationTitle } from "../services/aiService.js";
import { validateTitleRequest } from "../validation.js";

export const titleRouter = Router();

// A small, separate, non-streaming endpoint -- the frontend only ever
// calls this in the background after a conversation's first exchange
// completes, and treats any failure here as non-blocking (see App.tsx),
// so a plain single JSON response (not ndjson like /api/chat) is simpler
// and sufficient; there's nothing to show progressively for a few words.
titleRouter.post("/title", async (req, res, next) => {
  try {
    const { model, userMessage, assistantMessage } = validateTitleRequest(req.body);
    const title = await generateConversationTitle(model, userMessage, assistantMessage);
    res.json({ title });
  } catch (error) {
    next(error);
  }
});
