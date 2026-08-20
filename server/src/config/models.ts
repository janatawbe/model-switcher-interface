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
// For $0 development, all three currently resolve to OpenRouter's own
// "openrouter/free" router (a free-model router OpenRouter provides for
// exactly this purpose -- verified live against
// https://openrouter.ai/api/v1/models before wiring it in). To go live
// with the real per-provider models later, swap only the
// `openRouterModel` values below -- e.g.:
//   gpt    -> "openai/gpt-5.1"
//   gemini -> "google/gemini-3-pro"
//   claude -> "anthropic/claude-opus-4.5"
// No other file needs to change.
export const MODEL_REGISTRY: Record<ModelId, ModelRegistryEntry> = {
  gpt: {
    id: "gpt",
    displayName: "GPT",
    description: "OpenAI's GPT model.",
    openRouterModel: "openrouter/free",
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
