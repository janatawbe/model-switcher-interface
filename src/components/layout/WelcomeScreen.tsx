// Initial landing screen: presents the model cards used to start a new conversation.
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { MODELS, getModelIndex } from "../ui/models";
import { BrandMark } from "../ui/BrandMark";
import { Aurora } from "./Aurora";

type WelcomeScreenProps = {
  previewModel: string | null;
  onSelectModel: (modelId: string) => void;
  onPreviewModel: (modelId: string | null) => void;
};

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } },
};

// The dedicated no-model landing experience: the whole app canvas, no
// sidebar/header/input, since there's no conversation yet to frame. Mounts
// its own Aurora (activeModel is always null here -- the balanced,
// three-color idle field) and hands off to the existing chat shell the
// moment a model is chosen.
export function WelcomeScreen({ previewModel, onSelectModel, onPreviewModel }: WelcomeScreenProps) {
  const reducedMotion = useReducedMotion();
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const springX = useSpring(mvX, { stiffness: 50, damping: 18, mass: 0.6 });
  const springY = useSpring(mvY, { stiffness: 50, damping: 18, mass: 0.6 });
  const markX = useTransform(springX, (v) => v * 12);
  const markY = useTransform(springY, (v) => v * 12);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mvX.set((event.clientX - rect.left) / rect.width - 0.5);
    mvY.set((event.clientY - rect.top) / rect.height - 0.5);
  };
  const handlePointerLeave = () => {
    mvX.set(0);
    mvY.set(0);
  };

  const emphasisIndex = previewModel ? getModelIndex(previewModel) : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050609] text-neutral-100">
      <Aurora activeModel={null} previewModel={previewModel} />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-8 text-center sm:gap-5"
      >
        {/* hero mark: light beam + concentric rings + the product mark itself */}
        <motion.div
          variants={item}
          style={{ x: markX, y: markY }}
          className="relative flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40"
        >
          <div className="absolute h-[168px] w-[168px] rounded-full bg-[radial-gradient(closest-side,rgba(3,4,7,0.7),transparent)] sm:h-[220px] sm:w-[220px]" />
          <div className="absolute left-1/2 top-1/2 h-[260px] w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-100/60 to-transparent" />
          <div className="absolute h-24 w-24 rounded-full border border-white/[0.18] sm:h-28 sm:w-28" />
          <div className="absolute h-32 w-32 rounded-full border border-white/[0.11] sm:h-40 sm:w-40" />
          <div className="absolute h-[168px] w-[168px] rounded-full border border-white/[0.06] sm:h-[200px] sm:w-[200px]" />
          <div className="absolute h-16 w-16 rounded-full bg-[radial-gradient(closest-side,rgba(3,4,7,0.65),transparent)] sm:h-20 sm:w-20" />
          <BrandMark size={56} variant="spectrum" emphasis={emphasisIndex} className="relative text-white sm:hidden" />
          <BrandMark size={72} variant="spectrum" emphasis={emphasisIndex} className="relative hidden text-white sm:block" />
        </motion.div>

        {/* a soft, wide, blurred dark plate behind the text stack only --
            guarantees contrast no matter how bright the aurora gets at any
            given point, without reading as a hard card */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#030407]/45 blur-3xl" />

        {/* product identity: the biggest, most prominent text on the screen */}
        <motion.h1
          variants={item}
          className="text-[15vw] font-black leading-[0.98] tracking-[-0.03em] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.95),0_14px_56px_rgba(0,0,0,0.85)] sm:text-[68px] md:text-[84px] lg:text-[96px]"
        >
          AI Model Switcher
        </motion.h1>

        <div className="flex flex-col gap-0.5">
          <motion.p
            variants={item}
            className="text-lg font-medium text-neutral-50 [text-shadow:0_1px_5px_rgba(0,0,0,0.9),0_8px_28px_rgba(0,0,0,0.75)] sm:text-xl"
          >
            Switch perspectives.
          </motion.p>
          <motion.p
            variants={item}
            className="text-base text-neutral-200 [text-shadow:0_1px_4px_rgba(0,0,0,0.9),0_6px_22px_rgba(0,0,0,0.75)] sm:text-lg"
          >
            One interface. Multiple minds.
          </motion.p>
        </div>

        <motion.p variants={item} className="text-sm text-neutral-300 [text-shadow:0_1px_4px_rgba(0,0,0,0.85)]">
          Choose a model to get started
        </motion.p>

        {/* three portals into the models: colored edge + glow that merges
            into the surrounding aurora, not ordinary cards on a background */}
        <motion.div variants={item} className="mt-2 flex flex-wrap items-stretch justify-center gap-3 sm:gap-4">
          {MODELS.map((model, index) => {
            const Icon = model.icon;
            const isEmphasized = emphasisIndex === index;
            const [pr, pg, pb] = model.aurora.primary;
            const glow = `rgba(${Math.round(pr * 255)}, ${Math.round(pg * 255)}, ${Math.round(pb * 255)}, 0.8)`;
            return (
              <motion.button
                key={model.id}
                type="button"
                onMouseEnter={() => onPreviewModel(model.id)}
                onMouseLeave={() => onPreviewModel(null)}
                onFocus={() => onPreviewModel(model.id)}
                onBlur={() => onPreviewModel(null)}
                onClick={() => onSelectModel(model.id)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="group relative flex w-[164px] flex-col items-center gap-2.5 rounded-2xl px-5 py-6 sm:w-[180px]"
              >
                {/* this model's energy pushing out from the environment, not
                    a card background changing color */}
                <span
                  aria-hidden="true"
                  className={`absolute -inset-6 -z-10 rounded-[36px] blur-3xl transition-opacity duration-300 ${model.accent.softBg} ${
                    isEmphasized ? "opacity-100" : "opacity-0 group-hover:opacity-80"
                  }`}
                />
                <span
                  className={`absolute inset-0 -z-10 rounded-2xl border bg-white/[0.03] backdrop-blur-xl transition-colors duration-300 ${
                    isEmphasized ? `${model.accent.border} bg-white/[0.07]` : "border-white/[0.09] group-hover:border-white/[0.16]"
                  }`}
                />
                {/* fixed icon slot: a glyph's own path geometry could in
                    principle render at a different optical size than the
                    others at the same nominal size prop, so every icon is
                    centered in an identically-sized box rather than
                    dropped straight into the flex stack -- that keeps the
                    title/subtitle baselines identical across cards
                    regardless of any individual glyph's rendered size. */}
                <motion.span
                  animate={{ scale: isEmphasized ? 1.12 : 1 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ filter: isEmphasized ? `drop-shadow(0 0 10px ${glow})` : "none" }}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center transition-[filter] duration-300 ${model.accent.text}`}
                >
                  <Icon size={30} />
                </motion.span>
                <span className="text-base font-semibold text-neutral-50">{model.label}</span>
                {/* reserved for two lines regardless of actual tagline
                    length, so a one-line tagline doesn't leave its card
                    shorter than its neighbors */}
                <span
                  className={`min-h-[30px] text-[11px] leading-snug transition-colors duration-300 ${model.accent.text} opacity-80`}
                >
                  {model.tagline}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
