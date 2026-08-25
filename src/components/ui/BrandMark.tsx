// Renders the application's own logo mark as an SVG built from the model palette.
import { motion } from "motion/react";
import { MODELS } from "./models";

type BrandMarkProps = {
  size?: number;
  variant?: "mono" | "spectrum";
  // Which model's arc to spotlight (mirrors whatever's hovered/previewed);
  // null = balanced, all three equally present.
  emphasis?: number | null;
  className?: string;
};

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_FRACTION = 0.26;
const ARC_LEN = CIRCUMFERENCE * ARC_FRACTION;
const MONO_OPACITY = [1, 0.7, 0.45];

function toCss([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

// The product's own identity mark: three distinct, model-colored arcs --
// three perspectives -- connected by thin spokes to one shared hub -- one
// interface. Not a knot or a sparkle, and not any single model's glyph: a
// literal three-position switch, which is what this product actually is.
export function BrandMark({ size = 32, variant = "mono", emphasis = null, className = "" }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      {MODELS.map((model, index) => {
        const isEmphasized = emphasis === index;
        const isDimmed = emphasis !== null && !isEmphasized;
        const baseOpacity = variant === "spectrum" ? 0.95 : MONO_OPACITY[index];
        const midAngle = ((index * 120 + (ARC_FRACTION * 360) / 2) * Math.PI) / 180;
        const spokeInner = 13;
        const spokeOuter = RADIUS - 6;
        return (
          <g key={model.id}>
            <line
              x1={50 + spokeInner * Math.cos(midAngle)}
              y1={50 + spokeInner * Math.sin(midAngle)}
              x2={50 + spokeOuter * Math.cos(midAngle)}
              y2={50 + spokeOuter * Math.sin(midAngle)}
              stroke="currentColor"
              strokeWidth="1"
              opacity={isDimmed ? 0.08 : 0.2}
            />
            <motion.circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke={variant === "spectrum" ? toCss(model.aurora.primary) : "currentColor"}
              strokeLinecap="round"
              strokeDasharray={`${ARC_LEN} ${CIRCUMFERENCE - ARC_LEN}`}
              transform={`rotate(${index * 120} 50 50)`}
              initial={false}
              animate={{
                opacity: isDimmed ? baseOpacity * 0.35 : isEmphasized ? 1 : baseOpacity,
                strokeWidth: isEmphasized ? 13 : 10,
              }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </g>
        );
      })}
      <circle cx="50" cy="50" r="10" fill="currentColor" opacity={variant === "spectrum" ? 0.92 : 0.85} />
      <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
    </svg>
  );
}
