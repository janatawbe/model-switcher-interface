import type { ModelId } from "../types/ai.js";

export type ModelRegistryEntry = {
  id: ModelId;
  displayName: string;
  description: string;
  // The real OpenRouter model identifier this app ID currently resolves to.
  openRouterModel: string;
};

// Single source of truth for "our app ID" -> "real OpenRouter model ID".
// The frontend only ever knows about gpt/gemma/nemotron; everything below
// this point is server-only and never sent to the browser.
//
// All three app IDs now resolve to specific, real, free models (Milestone
// 5 replaced the earlier openrouter/free placeholders for gemma/nemotron
// with the actual Google/NVIDIA free models). Every ID here was verified
// live against https://openrouter.ai/api/v1/models before wiring it in --
// to point an app ID at a different OpenRouter model later, change only
// its `openRouterModel` value below. No other file needs to change.
export const MODEL_REGISTRY: Record<ModelId, ModelRegistryEntry> = {
  gpt: {
    id: "gpt",
    displayName: "GPT",
    description: "OpenAI's open-weight gpt-oss-20b model, served free via OpenRouter.",
    openRouterModel: "openai/gpt-oss-20b:free",
  },
  gemma: {
    id: "gemma",
    displayName: "Gemma",
    description: "Google's open-weight Gemma 4 26B A4B model, served free via OpenRouter.",
    openRouterModel: "google/gemma-4-26b-a4b-it:free",
  },
  nemotron: {
    id: "nemotron",
    displayName: "Nemotron",
    description: "NVIDIA's open-weight Nemotron 3 Super model, served free via OpenRouter.",
    openRouterModel: "nvidia/nemotron-3-super-120b-a12b:free",
  },
};

export function resolveModel(id: ModelId): ModelRegistryEntry {
  return MODEL_REGISTRY[id];
}
