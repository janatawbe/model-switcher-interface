// Central registry for supported AI models and their provider configuration.
import type { ModelId } from "../types/ai.js";

export type ModelRegistryEntry = {
  id: ModelId;
  // The real OpenRouter model identifier this app ID currently resolves to.
  openRouterModel: string;
};

// Single source of truth for "our app ID" -> "real OpenRouter model ID".
// The frontend only ever knows about minimax-m3/nemotron/laguna; everything
// below this point is server-only and never sent to the browser.
//
// All three app IDs now resolve to specific, real, free models (Milestone
// 5 replaced the earlier openrouter/free placeholders for the original
// Gemma/Nemotron entries with the actual Google/NVIDIA free models).
// Every ID here was verified live against
// https://openrouter.ai/api/v1/models before wiring it in -- to point an
// app ID at a different OpenRouter model later, change only its
// `openRouterModel` value below. No other file needs to change.
export const MODEL_REGISTRY: Record<ModelId, ModelRegistryEntry> = {
  // This slot has been replaced twice: Gemma (google/gemma-4-31b-it:free,
  // app id "gemma") became Inkling (thinkingmachines/inkling:free, app id
  // "inkling" -- dropped after OpenRouter confirmed that model only serves
  // agentic-harness requests, not plain chat completions), which is now
  // MiniMax M3. Same position in the lineup and aurora color throughout.
  "minimax-m3": {
    id: "minimax-m3",
    openRouterModel: "minimax/minimax-m3:free",
  },
  nemotron: {
    id: "nemotron",
    openRouterModel: "nvidia/nemotron-3-super-120b-a12b:free",
  },
  laguna: {
    id: "laguna",
    openRouterModel: "poolside/laguna-s-2.1:free",
  },
};

export function resolveModel(id: ModelId): ModelRegistryEntry {
  return MODEL_REGISTRY[id];
}
