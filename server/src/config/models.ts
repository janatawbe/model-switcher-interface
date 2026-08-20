import type { ModelId } from "../types/ai.js";

export type ModelRegistryEntry = {
  id: ModelId;
  displayName: string;
  description: string;
  // The real OpenRouter model identifier this app ID currently resolves to.
  openRouterModel: string;
};

// Single source of truth for "our app ID" -> "real OpenRouter model ID".
// The frontend only ever knows about gpt/gemini/claude; everything below
// this point is server-only and never sent to the browser.
//
// gpt is wired to a specific, real, free OpenAI model (Milestone 4).
// gemini/claude still resolve to OpenRouter's own "openrouter/free" router
// (a free-model router OpenRouter provides for exactly this purpose) as a
// $0 placeholder pending Milestone 5. All model IDs here were verified
// live against https://openrouter.ai/api/v1/models before wiring them in
// -- to go live with real per-provider models later, swap only the
// `openRouterModel` values below. No other file needs to change.
export const MODEL_REGISTRY: Record<ModelId, ModelRegistryEntry> = {
  gpt: {
    id: "gpt",
    displayName: "GPT",
    description: "OpenAI's open-weight gpt-oss-20b model, served free via OpenRouter.",
    openRouterModel: "openai/gpt-oss-20b:free",
  },
  gemini: {
    id: "gemini",
    displayName: "Gemini",
    description: "Google's Gemini model.",
    openRouterModel: "openrouter/free",
  },
  claude: {
    id: "claude",
    displayName: "Claude",
    description: "Anthropic's Claude model.",
    openRouterModel: "openrouter/free",
  },
};

export function resolveModel(id: ModelId): ModelRegistryEntry {
  return MODEL_REGISTRY[id];
}
