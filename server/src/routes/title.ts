// Endpoint for generating an automatic conversation title from its first exchange.
import { Router } from "express";
import { generateConversationTitle } from "../services/aiService.js";
import { validateTitleRequest } from "../validation.js";

export const titleRouter = Router();

// Called in the background after the first exchange; failures are non-blocking.
titleRouter.post("/title", async (req, res, next) => {
  try {
    const { model, userMessage, assistantMessage } = validateTitleRequest(req.body);
    const title = await generateConversationTitle(model, userMessage, assistantMessage);
    res.json({ title });
  } catch (error) {
    next(error);
  }
});
