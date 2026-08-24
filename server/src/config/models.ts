import type { ModelId } from "../types/ai.js";

export type ModelRegistryEntry = {
  id: ModelId;
  displayName: string;
  description: string;
  // The real OpenRouter model identifier this app ID currently resolves to.
  openRouterModel: string;
};

// Single source of truth for "our app ID" -> "real OpenRouter model ID".
// The frontend only ever knows about gemma/nemotron/laguna; everything
// below this point is server-only and never sent to the browser.
//
// All three app IDs now resolve to specific, real, free models (Milestone
// 5 replaced the earlier openrouter/free placeholders for gemma/nemotron
// with the actual Google/NVIDIA free models). Every ID here was verified
// live against https://openrouter.ai/api/v1/models before wiring it in --
// to point an app ID at a different OpenRouter model later, change only
// its `openRouterModel` value below. No other file needs to change.
export const MODEL_REGISTRY: Record<ModelId, ModelRegistryEntry> = {
  gemma: {
    id: "gemma",
    displayName: "Gemma",
    description: "Google's open-weight Gemma 4 31B model, served free via OpenRouter.",
    openRouterModel: "google/gemma-4-31b-it:free",
  },
  nemotron: {
    id: "nemotron",
    displayName: "Nemotron",
    description: "NVIDIA's open-weight Nemotron 3 Super model, served free via OpenRouter.",
    openRouterModel: "nvidia/nemotron-3-super-120b-a12b:free",
  },
  laguna: {
    id: "laguna",
    displayName: "Laguna",
    description: "Poolside's open-weight Laguna model, served free via OpenRouter.",
    openRouterModel: "poolside/laguna-s-2.1:free",
  },
};

export function resolveModel(id: ModelId): ModelRegistryEntry {
  return MODEL_REGISTRY[id];
}
