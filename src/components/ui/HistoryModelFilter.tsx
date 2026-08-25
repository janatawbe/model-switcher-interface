// Sidebar dropdown for filtering conversation history by model.
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ListFilter } from "lucide-react";
import { MODELS, getModel } from "./models";
import { glass } from "./theme";
import { usePopoverDismiss } from "../../hooks/usePopoverDismiss";

type HistoryModelFilterProps = {
  value: string;
  onChange: (modelId: string) => void;
};

// Same trigger+popover pattern as ModelSelector, anchored to the left edge.
export function HistoryModelFilter({ value, onChange }: HistoryModelFilterProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const current = value === "all" ? null : getModel(value);
  const CurrentIcon = current?.icon;

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, left: rect.left });
    }
  }, [open]);

  usePopoverDismiss(open, () => setOpen(false), triggerRef, panelRef);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current ? `Filtering by ${current.label}` : "Filter conversations by model"}
        title={current ? `Filtering by ${current.label}` : "Filter by model"}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 ${
          current ? `${glass.base} ${current.accent.text}` : "text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200"
        }`}
      >
        {current && CurrentIcon ? (
          <>
            <span className={`absolute inset-0 rounded-lg opacity-40 ${current.accent.softBg}`} />
            <span className="relative">
              <CurrentIcon size={14} />
            </span>
            <motion.span
              className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${current.accent.dot}`}
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        ) : (
          <ListFilter size={14} />
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={panelRef}
              role="listbox"
              aria-label="Filter conversations by model"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "fixed", top: coords.top, left: coords.left }}
              className={`z-50 w-44 origin-top-left rounded-xl ${glass.solid} p-1.5`}
            >
              <button
                type="button"
                role="option"
                aria-selected={value === "all"}
                onClick={() => {
                  onChange("all");
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium transition-colors ${
                  value === "all" ? "bg-white/[0.09] text-neutral-50" : "text-neutral-300 hover:bg-white/[0.05]"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-neutral-400">
                  <ListFilter size={11} />
                </span>
                <span className="flex-1">All Models</span>
                {value === "all" && <Check size={13} strokeWidth={2.5} className="text-neutral-300" />}
              </button>

              <div className="my-1 h-px bg-white/[0.06]" />

              {MODELS.map((model) => {
                const isSelected = value === model.id;
                const Icon = model.icon;
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(model.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium transition-colors ${
                      isSelected ? `${model.accent.softBg} text-neutral-50` : "text-neutral-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] ${model.accent.text}`}
                    >
                      <Icon size={11} />
                    </span>
                    <span className="flex-1">{model.label}</span>
                    <AnimatePresence initial={false}>
                      {isSelected && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ duration: 0.12 }}
                          className={model.accent.text}
                        >
                          <Check size={13} strokeWidth={2.5} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
