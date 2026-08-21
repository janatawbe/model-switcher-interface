import type { ReactElement } from "react";
import { GemmaGlyph, NvidiaGlyph, OpenAIGlyph, type ModelGlyphProps } from "./ModelGlyphs";

// The real, recognizable per-model mark (not a generic icon-library glyph),
// used everywhere a model's identity is shown -- welcome cards, selector,
// chat header, message bubbles -- so a model always looks like itself.
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
  // Relative pull in the balanced idle (no hover, no selection) state.
  // 1 = equal share. Some palettes are inherently quieter than others at
  // equal weight (a muted copper reads smaller than a vivid violet/cyan
  // at the same numeric share), so this compensates for perceived
  // presence rather than literal pixel area. Defaults to 1.
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
    id: "gpt",
    label: "GPT",
    provider: "OpenAI",
    tagline: "Creative · Precise · Versatile",
    icon: OpenAIGlyph,
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
  {
    id: "gemma",
    label: "Gemma",
    provider: "Google",
    tagline: "Compact · Multilingual · Fast",
    icon: GemmaGlyph,
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
      // Google blue, pushed a little brighter than the literal brand hex --
      // blue reads quieter than violet/green at matched luminance, so it
      // gets both a brightness nudge and a small idleWeight boost below.
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
      // NVIDIA's signature yellow-green -- already reads at comparable
      // luminance to the violet/blue at equal weight, so no idleWeight
      // compensation needed here.
      primary: [0.55, 0.85, 0.15],
      secondary: [0.32, 0.62, 0.05],
      highlight: [0.85, 1.0, 0.55],
    },
  },
];

export function getModel(modelId: string | null | undefined): ModelOption | undefined {
  return MODELS.find((model) => model.id === modelId);
}

export function getModelLabel(modelId: string | null | undefined): string {
  if (!modelId) return "Assistant";
  return getModel(modelId)?.label ?? modelId;
}

export function getModelIndex(modelId: string | null | undefined): number {
  const index = MODELS.findIndex((model) => model.id === modelId);
  return index === -1 ? 0 : index;
}
