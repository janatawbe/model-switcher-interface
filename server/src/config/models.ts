// Central registry for supported AI models and their provider configuration.
import type { ModelId } from "../types/ai.js";

export type ModelRegistryEntry = {
  id: ModelId;
  // Real OpenRouter model id this app id maps to.
  openRouterModel: string;
};

// Maps app model ids to real OpenRouter model ids. Server-only.
export const MODEL_REGISTRY: Record<ModelId, ModelRegistryEntry> = {
  // Ids can be replaced over time; old ones still resolve via aliases (see types/ai.ts).
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
