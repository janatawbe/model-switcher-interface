import { Router } from "express";
import { sendMessage } from "../services/aiService.js";
import type { ChatResponse } from "../types/ai.js";
import { validateChatRequest } from "../validation.js";

export const chatRouter = Router();

// Route -> AI service -> OpenRouter. This handler never talks to
// OpenRouter itself -- it only validates the request and shapes the AI
// service's response into our application's response contract.
chatRouter.post("/chat", async (req, res, next) => {
  try {
    const chatRequest = validateChatRequest(req.body);
    const result = await sendMessage(chatRequest);

    const response: ChatResponse = {
      message: { ...result.message, model: chatRequest.model },
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});
