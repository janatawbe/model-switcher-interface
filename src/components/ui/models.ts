// Defines the available AI models and their display metadata.
import type { ReactElement } from "react";
import { MiniMaxGlyph, NvidiaGlyph, PoolsideGlyph, type ModelGlyphProps } from "./ModelGlyphs";

// Icon shown everywhere a model's identity appears.
export type ModelIconComponent = (props: ModelGlyphProps) => ReactElement;

export type ModelAccent = {
  text: string;
  dot: string;
  ring: string;
  focusRing: string;
  softBg: string;
  border: string;
  solidButton: string;
  glow: string;
};

// RGB triples in 0..1, consumed directly as WebGL shader uniforms.
export type AuroraPalette = {
  primary: [number, number, number];
  secondary: [number, number, number];
  highlight: [number, number, number];
  // Relative pull in the idle blend; compensates for quieter palettes. Defaults to 1.
  idleWeight?: number;
};

export type ModelOption = {
  id: string;
  label: string;
  provider: string;
  tagline: string;
  icon: ModelIconComponent;
  accent: ModelAccent;
  aurora: AuroraPalette;
};

export const MODELS: ModelOption[] = [
  {
    id: "minimax-m3",
    label: "MiniMax M3",
    provider: "MiniMax",
    tagline: "Multilingual · Efficient · Fast",
    icon: MiniMaxGlyph,
    // Inherited unchanged from the model this replaced.
    accent: {
      text: "text-blue-300",
      dot: "bg-blue-400",
      ring: "ring-blue-400/25",
      focusRing: "focus-within:ring-blue-400/20",
      softBg: "bg-blue-500/10",
      border: "border-blue-400/30",
      solidButton: "bg-blue-500 hover:bg-blue-400 text-white",
      glow: "shadow-[0_0_40px_-10px_rgba(66,133,244,0.5)]",
    },
    aurora: {
      primary: [0.42, 0.62, 1.0],
      secondary: [0.18, 0.38, 0.88],
      highlight: [0.82, 0.9, 1.0],
      idleWeight: 1.15,
    },
  },
  {
    id: "nemotron",
    label: "Nemotron",
    provider: "NVIDIA",
    tagline: "Reasoning · Agentic · Scalable",
    icon: NvidiaGlyph,
    accent: {
      text: "text-lime-300",
      dot: "bg-lime-400",
      ring: "ring-lime-400/25",
      focusRing: "focus-within:ring-lime-400/20",
      softBg: "bg-lime-500/10",
      border: "border-lime-400/30",
      solidButton: "bg-lime-500 hover:bg-lime-400 text-white",
      glow: "shadow-[0_0_40px_-10px_rgba(132,204,22,0.5)]",
    },
    aurora: {
      primary: [0.55, 0.85, 0.15],
      secondary: [0.32, 0.62, 0.05],
      highlight: [0.85, 1.0, 0.55],
    },
  },
  {
    id: "laguna",
    label: "Laguna",
    provider: "Poolside",
    tagline: "Code-Fluent · Fast · Adaptive",
    icon: PoolsideGlyph,
    // Inherited unchanged from the model this replaced.
    accent: {
      text: "text-violet-300",
      dot: "bg-violet-400",
      ring: "ring-violet-400/25",
      focusRing: "focus-within:ring-violet-400/20",
      softBg: "bg-violet-500/10",
      border: "border-violet-400/30",
      solidButton: "bg-violet-500 hover:bg-violet-400 text-white",
      glow: "shadow-[0_0_40px_-10px_rgba(139,92,246,0.5)]",
    },
    aurora: {
      primary: [0.74, 0.6, 0.99],
      secondary: [0.52, 0.24, 0.97],
      highlight: [0.97, 0.94, 1.0],
    },
  },
];

// Maps old model ids (gemma, inkling) to their replacement for old conversations.
const LEGACY_MODEL_ID_ALIASES: Record<string, string> = { gemma: "minimax-m3", inkling: "minimax-m3" };

function resolveModelId(modelId: string | null | undefined): string | null | undefined {
  if (!modelId) return modelId;
  return LEGACY_MODEL_ID_ALIASES[modelId] ?? modelId;
}

export function getModel(modelId: string | null | undefined): ModelOption | undefined {
  const resolved = resolveModelId(modelId);
  return MODELS.find((model) => model.id === resolved);
}

export function getModelLabel(modelId: string | null | undefined): string {
  if (!modelId) return "Assistant";
  return getModel(modelId)?.label ?? modelId;
}

export function getModelIndex(modelId: string | null | undefined): number {
  const resolved = resolveModelId(modelId);
  const index = MODELS.findIndex((model) => model.id === resolved);
  return index === -1 ? 0 : index;
}
