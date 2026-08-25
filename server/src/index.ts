// Sets up the Express app: middleware, routes, and error handling.
import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { chatRouter } from "./routes/chat.js";
import { healthRouter } from "./routes/health.js";
import { titleRouter } from "./routes/title.js";
import { ApiError } from "./types/ai.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.use("/api", healthRouter);
app.use("/api", chatRouter);
app.use("/api", titleRouter);

// Turns known errors into clean JSON; hides raw errors from clients.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.resetAt ? { resetAt: err.resetAt } : {}) },
    });
    return;
  }

  console.error("Unexpected server error:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong on our end." },
  });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`AI Model Switcher backend listening on http://localhost:${PORT}`);
});
