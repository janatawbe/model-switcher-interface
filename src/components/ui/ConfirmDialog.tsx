// Shared portal/backdrop dialog used by the app's confirmation prompts.
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { glass } from "./theme";

type ConfirmDialogProps = {
  headingId: string;
  heading: string;
  description: ReactNode;
  // Icon or visual shown above the heading.
  topContent: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  // Confirm button styling, e.g. red for delete, model accent for switch.
  confirmClassName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Shared confirmation dialog used before consequential actions.
export function ConfirmDialog({
  headingId,
  heading,
  description,
  topContent,
  cancelLabel,
  confirmLabel,
  confirmClassName,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
        aria-labelledby={headingId}
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl ${glass.solid} p-6 text-center`}
      >
        {topContent}

        <h2 id={headingId} className="mt-4 text-base font-semibold text-neutral-50">
          {heading}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{description}</p>

        {/* Keeps both buttons the same size regardless of label length. */}
        <div className="mt-5 flex items-stretch gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl ${glass.raised} px-4 text-center text-sm font-medium leading-tight text-neutral-200 transition-colors hover:bg-white/[0.08]`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 text-center text-sm font-medium leading-tight transition-colors ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
