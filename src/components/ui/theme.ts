// Material hierarchy for the atmospheric visual system.
// base   -> ambient surfaces that recede (sidebar, header)
// raised -> resting interactive controls (New Chat, suggestions, selector trigger, input)
// solid  -> isolated overlays that must not let content bleed through (dropdown panel)
export const glass = {
  base: "border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl",
  raised: "border border-white/[0.08] bg-white/[0.05] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
  solid:
    "border border-white/[0.09] bg-[#0d0e16] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_45px_-12px_rgba(0,0,0,0.65)]",
};
