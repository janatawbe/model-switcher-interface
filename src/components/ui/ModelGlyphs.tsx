import { useId } from "react";

// Real, recognizable brand marks for each provider (not generic icon-library
// glyphs) so a model is instantly identifiable by its actual logo everywhere
// it appears. Path data from @lobehub/icons-static-svg (MIT licensed,
// single-color "mark" variants) so they tint cleanly via currentColor to
// match this app's own per-model accent color.
export type ModelGlyphProps = {
  size?: number;
  className?: string;
};

// Poolside's mark ships as three overlapping soft-edged gradient shapes
// (each fading via its own linearGradient) rather than a flat path, so --
// same reasoning as Gemma below -- its gradient/mask/clipPath ids need to
// be unique per render or two simultaneous instances (e.g. the welcome
// card and the header selector open at once) would fight over the same
// SVG ids and one would render blank.
export function PoolsideGlyph({ size = 16, className }: ModelGlyphProps) {
  const uid = useId();
  const clipId = `poolside-clip-${uid}`;
  const maskId = `poolside-mask-${uid}`;
  const gradientId1 = `poolside-gradient-1-${uid}`;
  const gradientId2 = `poolside-gradient-2-${uid}`;
  const gradientId3 = `poolside-gradient-3-${uid}`;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      className={className}
      aria-hidden="true"
    >
      <g clipPath={`url(#${clipId})`}>
        <mask height="24" id={maskId} maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} width="24" x="0" y="0">
          <path d="M24 0H0v24h24V0z" fill={`url(#${gradientId1})`} />
          <path d="M24 0H0v24h24V0z" fill={`url(#${gradientId2})`} />
          <path d="M24 0H0v24h24V0z" fill={`url(#${gradientId3})`} />
        </mask>
        <g mask={`url(#${maskId})`}>
          <path d="M6.742 22.786a11.93 11.93 0 01-5.232-4.963 11.98 11.98 0 01-1.463-6.886.975.975 0 011.943.173c-.178 2.005.246 4 1.226 5.769a9.968 9.968 0 003.526 3.685l4.586-9.405c-1.795-.598-3.29-.338-3.425-.312l-.058.012a.972.972 0 01-1.054-.576c-.24-.448-.96-1.544-1.834-1.97-.873-.426-2.218-.289-2.651-.195a.977.977 0 01-1.087-1.38C4.117.792 11.315-1.686 17.262 1.215c5.946 2.9 8.422 10.093 5.529 16.038l-.01.02c-2.903 5.94-10.095 8.414-16.039 5.514zm6.338-10.773l-4.586 9.405c4.629 1.73 9.896-.192 12.304-4.558-.338-.524-.932-1.275-1.62-1.61-.888-.434-2.19-.292-2.637-.198a.989.989 0 01-.616-.055.984.984 0 01-.49-.473c-.028-.058-.739-1.438-2.355-2.51zM5.81 6.56c.747.365 1.356.944 1.81 1.49 1.406-2.15 3.314-3.774 4.787-4.82a20.81 20.81 0 011.66-1.067A10.078 10.078 0 003.882 6.077c.617.042 1.297.174 1.929.482zm12.671-2.243c.09.624.152 1.294.182 1.965.083 1.801-.021 4.296-.844 6.722.686.018 1.484.14 2.214.495.652.318 1.198.8 1.628 1.28a10.082 10.082 0 00-3.18-10.462zm-5.394 5.46a9.522 9.522 0 012.984 2.287c1.075-3.493.606-7.402.215-8.85-1.381.584-4.75 2.62-6.84 5.618a9.515 9.515 0 013.64.944z" />
        </g>
      </g>
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={gradientId1} x1="6.75" x2="5.625" y1="20.55" y2="20.55">
          <stop stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={gradientId2} x1="6.825" x2="7.2" y1="11.85" y2="11.137">
          <stop stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={gradientId3} x1=".975" x2=".975" y1="20.512" y2="10.912">
          <stop stopColor="currentColor" />
          <stop offset=".105" stopColor="currentColor" stopOpacity=".9" />
          <stop offset=".904" stopColor="currentColor" stopOpacity=".04" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d="M0 0h24v24H0z" fill="currentColor" />
        </clipPath>
      </defs>
    </svg>
  );
}

// Google's own mark is authored as a mostly-solid disc with very fine
// internal facet/reticle linework -- at the small sizes this app renders
// icons at, a flat single-tone fill collapses that linework into what
// reads as a plain blob rather than "Gemma." Google's own official
// presentation of this exact mark uses a fixed blue gradient (not
// currentColor) precisely because the tonal shift across the disc is what
// makes the facets and reticle actually legible; matching that (gradient
// values below are Google's own, from the same icon set's color variant)
// fixes the legibility without changing the mark's geometry or this app's
// surrounding accent/color system. Its path also carries more built-in
// padding than the Poolside/NVIDIA marks (the reticle ring sits well inside
// the 24x24 box rather than touching its edges), so at an identical
// numeric size it reads visibly smaller -- scaled up here so all three
// marks land at the same optical size at every call site, with no other
// component needing to know about the difference.
const GEMMA_SCALE = 1.35;

export function GemmaGlyph({ size = 16, className }: ModelGlyphProps) {
  const gradientId = `gemma-gradient-${useId()}`;
  const rendered = size * GEMMA_SCALE;
  return (
    <svg viewBox="0 0 24 24" width={rendered} height={rendered} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="24.419%" y1="75.581%" x2="75.194%" y2="25.194%">
          <stop offset="0%" stopColor="#446EFF" />
          <stop offset="36.661%" stopColor="#2E96FF" />
          <stop offset="83.221%" stopColor="#B1C5FF" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
        d="M12.34 5.953a8.233 8.233 0 01-.247-1.125V3.72a8.25 8.25 0 015.562 2.232H12.34zm-.69 0c.113-.373.199-.755.257-1.145V3.72a8.25 8.25 0 00-5.562 2.232h5.304zm-5.433.187h5.373a7.98 7.98 0 01-.267.696 8.41 8.41 0 01-1.76 2.65L6.216 6.14zm-.264-.187H2.977v.187h2.915a8.436 8.436 0 00-2.357 5.767H0v.186h3.535a8.436 8.436 0 002.357 5.767H2.977v.186h2.976v2.977h.187v-2.915a8.436 8.436 0 005.767 2.357V24h.186v-3.535a8.436 8.436 0 005.767-2.357v2.915h.186v-2.977h2.977v-.186h-2.915a8.436 8.436 0 002.357-5.767H24v-.186h-3.535a8.436 8.436 0 00-2.357-5.767h2.915v-.187h-2.977V2.977h-.186v2.915a8.436 8.436 0 00-5.767-2.357V0h-.186v3.535A8.436 8.436 0 006.14 5.892V2.977h-.187v2.976zm6.14 14.326a8.25 8.25 0 005.562-2.233H12.34c-.108.367-.19.743-.247 1.126v1.107zm-.186-1.087a8.015 8.015 0 00-.258-1.146H6.345a8.25 8.25 0 005.562 2.233v-1.087zm-8.186-7.285h1.107a8.23 8.23 0 001.125-.247V6.345a8.25 8.25 0 00-2.232 5.562zm1.087.186H3.72a8.25 8.25 0 002.232 5.562v-5.304a8.012 8.012 0 00-1.145-.258zm15.47-.186a8.25 8.25 0 00-2.232-5.562v5.315c.367.108.743.19 1.126.247h1.107zm-1.086.186c-.39.058-.772.144-1.146.258v5.304a8.25 8.25 0 002.233-5.562h-1.087zm-1.332 5.69V12.41a7.97 7.97 0 00-.696.267 8.409 8.409 0 00-2.65 1.76l3.346 3.346zm0-6.18v-5.45l-.012-.013h-5.451c.076.235.162.468.26.696a8.698 8.698 0 001.819 2.688 8.698 8.698 0 002.688 1.82c.228.097.46.183.696.259zM6.14 17.848V12.41c.235.078.468.167.696.267a8.403 8.403 0 012.688 1.799 8.404 8.404 0 011.799 2.688c.1.228.19.46.267.696H6.152l-.012-.012zm0-6.245V6.326l3.29 3.29a8.716 8.716 0 01-2.594 1.728 8.14 8.14 0 01-.696.259zm6.257 6.257h5.277l-3.29-3.29a8.716 8.716 0 00-1.728 2.594 8.135 8.135 0 00-.259.696zm-2.347-7.81a9.435 9.435 0 01-2.88 1.96 9.14 9.14 0 012.88 1.94 9.14 9.14 0 011.94 2.88 9.435 9.435 0 011.96-2.88 9.14 9.14 0 012.88-1.94 9.435 9.435 0 01-2.88-1.96 9.434 9.434 0 01-1.96-2.88z"
      />
    </svg>
  );
}

export function NvidiaGlyph({ size = 16, className }: ModelGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M10.212 8.976V7.62c.127-.01.256-.017.388-.021 3.596-.117 5.957 3.184 5.957 3.184s-2.548 3.647-5.282 3.647a3.227 3.227 0 01-1.063-.175v-4.109c1.4.174 1.681.812 2.523 2.258l1.873-1.627a4.905 4.905 0 00-3.67-1.846 6.594 6.594 0 00-.729.044m0-4.476v2.025c.13-.01.259-.019.388-.024 5.002-.174 8.261 4.226 8.261 4.226s-3.743 4.69-7.643 4.69c-.338 0-.675-.031-1.007-.092v1.25c.278.038.558.057.838.057 3.629 0 6.253-1.91 8.794-4.169.421.347 2.146 1.193 2.501 1.564-2.416 2.083-8.048 3.763-11.24 3.763-.308 0-.603-.02-.894-.048V19.5H24v-15H10.21zm0 9.756v1.068c-3.356-.616-4.287-4.21-4.287-4.21a7.173 7.173 0 014.287-2.138v1.172h-.005a3.182 3.182 0 00-2.502 1.178s.615 2.276 2.507 2.931m-5.961-3.3c1.436-1.935 3.604-3.148 5.961-3.336V6.523C5.81 6.887 2 10.723 2 10.723s2.158 6.427 8.21 7.015v-1.166C5.77 16 4.25 10.958 4.25 10.958h-.002z" />
    </svg>
  );
}
