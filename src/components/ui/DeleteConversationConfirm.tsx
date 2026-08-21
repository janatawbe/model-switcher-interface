import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Trash2 } from "lucide-react";
import { glass } from "./theme";

type DeleteConversationConfirmProps = {
  conversationTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Deleting a conversation is destructive and permanent (no undo), so it
// gets the same "explicit confirmation, not a native confirm()" treatment
// as the Milestone 6 model-switch dialog -- same portal/backdrop/Escape
// pattern, just without the two-model layout that doesn't apply here.
export function DeleteConversationConfirm({ conversationTitle, onConfirm, onCancel }: DeleteConversationConfirmProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

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
        aria-labelledby="delete-conversation-heading"
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl ${glass.solid} p-6 text-center`}
      >
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300">
          <Trash2 size={18} />
        </div>

        <h2 id="delete-conversation-heading" className="mt-4 text-base font-semibold text-neutral-50">
          Delete this conversation?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
          &ldquo;{conversationTitle}&rdquo; will be permanently removed. This can&rsquo;t be undone.
        </p>

        <div className="mt-5 flex items-stretch gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl ${glass.raised} px-4 text-center text-sm font-medium leading-tight text-neutral-200 transition-colors hover:bg-white/[0.08]`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-red-500 px-4 text-center text-sm font-medium leading-tight text-white transition-colors hover:bg-red-400"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
