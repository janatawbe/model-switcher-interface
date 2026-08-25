// Placeholder shown for a new, message-free conversation with suggested prompts.
import { motion } from "motion/react";
import { Code2, Lightbulb, MessageCircle } from "lucide-react";
import { getModel } from "../ui/models";
import { glass } from "../ui/theme";
import { BrandMark } from "../ui/BrandMark";

const SUGGESTIONS = [
  { label: "Explain something", icon: Lightbulb },
  { label: "Brainstorm an idea", icon: MessageCircle },
  { label: "Help me code", icon: Code2 },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

type EmptyStateProps = {
  selectedModel: string | null;
  previewModel: string | null;
  onSuggestionSelect: (prompt: string) => void;
};

// Only ever rendered once a model is selected but no message has been sent
// yet -- the welcome-before-any-model moment is its own full-screen
// WelcomeScreen, mounted instead of the chat shell entirely.
export function EmptyState({ selectedModel, previewModel, onSuggestionSelect }: EmptyStateProps) {
  // The mark's color previews whatever's hovered (falling back to the
  // actual selection); the copy below only changes on a real selection --
  // a temporary hover must never claim a model has been chosen.
  const accent = getModel(previewModel ?? selectedModel)?.accent;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <motion.div variants={item} className="relative flex h-36 w-36 items-center justify-center">
        {/* atmospheric connection: ties the mark to the aurora behind it */}
        <div
          className={`absolute inset-0 rounded-full blur-2xl transition-colors duration-500 ${accent?.softBg ?? "bg-white/5"}`}
        />
        {/* depth separation: a soft dark vignette, not a card, that quiets the
            aurora immediately behind the mark so it reads as a nearer plane */}
        <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(closest-side,rgba(4,5,9,0.45),transparent)]" />
        <svg viewBox="0 0 100 100" className="absolute h-24 w-24" aria-hidden="true">
          <motion.circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            strokeWidth="1"
            strokeLinecap="round"
            strokeDasharray="70 218"
            className={`transition-colors duration-500 ${accent?.text ?? "text-neutral-300"}`}
            stroke="currentColor"
            opacity={0.4}
            animate={{ rotate: 360 }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50px 50px" }}
          />
        </svg>
        <div
          className={`relative flex h-[68px] w-[68px] items-center justify-center rounded-full border bg-white/[0.08] backdrop-blur-2xl transition-colors duration-500 ${accent?.border ?? "border-white/10"}`}
          style={{
            boxShadow:
              "0 10px 28px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16)",
          }}
        >
          <BrandMark
            size={26}
            variant="mono"
            className={`transition-colors duration-500 ${accent?.text ?? "text-neutral-300"}`}
          />
        </div>
      </motion.div>

      <motion.h2
        variants={item}
        className="text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-neutral-50 [text-shadow:0_1px_4px_rgba(0,0,0,0.85),0_6px_28px_rgba(0,0,0,0.65)]"
      >
        Ask anything to get started.
      </motion.h2>

      <motion.div variants={item} className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map(({ label, icon: Icon }) => (
          <motion.button
            key={label}
            type="button"
            onClick={() => onSuggestionSelect(label)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`group flex items-center gap-1.5 rounded-full ${glass.base} px-4 py-2 text-sm font-medium text-neutral-100 [text-shadow:0_1px_3px_rgba(0,0,0,0.75)] transition-colors hover:border-white/[0.16] hover:bg-white/[0.08]`}
          >
            <Icon size={14} className="text-neutral-300 transition-colors group-hover:text-neutral-100" />
            {label}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
