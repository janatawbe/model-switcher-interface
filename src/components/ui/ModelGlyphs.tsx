// Defines the visual glyphs used by the available AI models.
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
// (each fading via its own linearGradient) rather than a flat path, so its
// gradient/mask/clipPath ids need to be unique per render or two
// simultaneous instances (e.g. the welcome card and the header selector
// open at once) would fight over the same SVG ids and one would render
// blank.
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

export function MiniMaxGlyph({ size = 16, className }: ModelGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" fillRule="evenodd" className={className} aria-hidden="true">
      <path d="M16.278 2c1.156 0 2.093.927 2.093 2.07v12.501a.74.74 0 00.744.709.74.74 0 00.743-.709V9.099a2.06 2.06 0 012.071-2.049A2.06 2.06 0 0124 9.1v6.561a.649.649 0 01-.652.645.649.649 0 01-.653-.645V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v7.472a2.037 2.037 0 01-2.048 2.026 2.037 2.037 0 01-2.048-2.026v-12.5a.785.785 0 00-.788-.753.785.785 0 00-.789.752l-.001 15.904A2.037 2.037 0 0113.441 22a2.037 2.037 0 01-2.048-2.026V18.04c0-.356.292-.645.652-.645.36 0 .652.289.652.645v1.934c0 .263.142.506.372.638.23.131.514.131.744 0a.734.734 0 00.372-.638V4.07c0-1.143.937-2.07 2.093-2.07zm-5.674 0c1.156 0 2.093.927 2.093 2.07v11.523a.648.648 0 01-.652.645.648.648 0 01-.652-.645V4.07a.785.785 0 00-.789-.78.785.785 0 00-.789.78v14.013a2.06 2.06 0 01-2.07 2.048 2.06 2.06 0 01-2.071-2.048V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v3.8a2.06 2.06 0 01-2.071 2.049A2.06 2.06 0 010 12.9v-1.378c0-.357.292-.646.652-.646.36 0 .653.29.653.646V12.9c0 .418.343.757.766.757s.766-.339.766-.757V9.099a2.06 2.06 0 012.07-2.048 2.06 2.06 0 012.071 2.048v8.984c0 .419.343.758.767.758.423 0 .766-.339.766-.758V4.07c0-1.143.937-2.07 2.093-2.07z" />
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
