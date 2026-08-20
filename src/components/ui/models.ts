import type { ReactElement } from "react";
import { ClaudeGlyph, GeminiGlyph, OpenAIGlyph, type ModelGlyphProps } from "./ModelGlyphs";

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
    id: "gemini",
    label: "Gemini",
    provider: "Google",
    tagline: "Analytical · Fast · Insightful",
    icon: GeminiGlyph,
    accent: {
      text: "text-cyan-300",
      dot: "bg-cyan-400",
      ring: "ring-cyan-400/25",
      focusRing: "focus-within:ring-cyan-400/20",
      softBg: "bg-cyan-500/10",
      border: "border-cyan-400/30",
      solidButton: "bg-cyan-500 hover:bg-cyan-400 text-white",
      glow: "shadow-[0_0_40px_-10px_rgba(34,211,238,0.5)]",
    },
    aurora: {
      primary: [0.1, 0.92, 0.98],
      secondary: [0.02, 0.7, 0.68],
      highlight: [0.85, 1.0, 0.99],
    },
  },
  {
    id: "claude",
    label: "Claude",
    provider: "Anthropic",
    tagline: "Thoughtful · Nuanced · Reliable",
    icon: ClaudeGlyph,
    accent: {
      text: "text-orange-300",
      dot: "bg-orange-400",
      ring: "ring-orange-400/25",
      focusRing: "focus-within:ring-orange-400/20",
      softBg: "bg-orange-500/10",
      border: "border-orange-400/30",
      solidButton: "bg-orange-500 hover:bg-orange-400 text-white",
      glow: "shadow-[0_0_40px_-10px_rgba(249,115,22,0.5)]",
    },
    aurora: {
      // warm luminous tangerine -- brighter/richer than a muted copper so it
      // carries equal atmospheric weight next to the vivid violet/cyan, but
      // still keeps enough green/blue to stay soft rather than traffic-cone.
      // Pushed more saturated (less green/blue) than earlier passes: orange
      // reads flatter than violet/cyan against a near-black field at equal
      // luminance, so it needs more raw saturation, not just brightness, to
      // carry comparable visual presence.
      primary: [1.0, 0.55, 0.22],
      secondary: [0.95, 0.38, 0.09],
      highlight: [1.0, 0.8, 0.5],
      idleWeight: 1.55,
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
