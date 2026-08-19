import { Bot, Sparkles } from "lucide-react";

export type ModelOption = {
  id: string;
  label: string;
  icon: typeof Sparkles;
};

export const MODELS: ModelOption[] = [
  { id: "gpt", label: "GPT", icon: Sparkles },
  { id: "gemini", label: "Gemini", icon: Bot },
];

export function getModelLabel(modelId: string | undefined): string {
  if (!modelId) return "Assistant";
  return MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}
