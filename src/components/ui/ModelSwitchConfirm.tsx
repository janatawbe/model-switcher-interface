import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { getModel } from "./models";
import { glass } from "./theme";

type ModelSwitchConfirmProps = {
  fromModelId: string;
  toModelId: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Shown only when the user tries to switch models mid-conversation --
// silently reassigning an in-progress chat to a different model would make
// it look like that model said things it never did. Cancelling leaves the
// current model/conversation completely untouched; confirming switches
// models and starts a fresh conversation. Portalled to <body> with a
// full-viewport backdrop so it sits above everything (sidebar, header,
// the model selector's own dropdown) and is the only thing clickable
// while open.
export function ModelSwitchConfirm({ fromModelId, toModelId, onConfirm, onCancel }: ModelSwitchConfirmProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const fromModel = getModel(fromModelId);
  const toModel = getModel(toModelId);
  if (!fromModel || !toModel) return null;
  const FromIcon = fromModel.icon;
  const ToIcon = toModel.icon;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="model-switch-heading"
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl ${glass.solid} p-6 text-center`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Switch model</p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] ${fromModel.accent.text}`}
            >
              <FromIcon size={18} />
            </span>
            <span className="text-xs text-neutral-400">{fromModel.label}</span>
          </div>
          <ArrowRight size={16} className="shrink-0 text-neutral-600" />
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full border bg-white/[0.06] ${toModel.accent.border} ${toModel.accent.text}`}
            >
              <ToIcon size={18} />
            </span>
            <span className="text-xs font-medium text-neutral-100">{toModel.label}</span>
          </div>
        </div>

        <h2 id="model-switch-heading" className="mt-4 text-base font-semibold text-neutral-50">
          Start a new conversation?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
          Switching to {toModel.label} starts a fresh conversation. Your current chat with {fromModel.label} will
          be cleared from view.
        </p>

        {/* items-stretch + matching flex-centering inside each button
            guarantees identical size for both regardless of label length --
            "Keep {model}" is reliably one line while the confirm label can
            wrap on narrower models' names, which previously left the two
            buttons visually mismatched in height. */}
        <div className="mt-5 flex items-stretch gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl ${glass.raised} px-4 text-center text-sm font-medium leading-tight text-neutral-200 transition-colors hover:bg-white/[0.08]`}
          >
            Keep {fromModel.label}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 text-center text-sm font-medium leading-tight transition-colors ${toModel.accent.solidButton}`}
          >
            Switch & New Chat
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
