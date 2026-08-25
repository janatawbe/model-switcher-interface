// Header dropdown for choosing and previewing the active AI model.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { MODELS, getModel } from "./models";
import { glass } from "./theme";
import { usePopoverDismiss } from "../../hooks/usePopoverDismiss";

type ModelSelectorProps = {
  selectedModel: string | null;
  onSelectModel: (modelId: string) => void;
  onPreviewModel?: (modelId: string | null) => void;
};

export function ModelSelector({ selectedModel, onSelectModel, onPreviewModel }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const current = getModel(selectedModel);
  const CurrentIcon = current?.icon;

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
  }, [open]);

  useEffect(() => {
    if (!open) onPreviewModel?.(null);
  }, [open, onPreviewModel]);

  usePopoverDismiss(open, () => setOpen(false), triggerRef, panelRef);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2.5 rounded-xl ${glass.raised} px-3 py-2 text-sm font-medium text-neutral-100 transition-colors duration-300 hover:bg-white/[0.08]`}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          {current && CurrentIcon ? (
            <>
              <span
                className={`absolute inset-0 rounded-full blur-[6px] transition-colors duration-300 ${current.accent.softBg}`}
              />
              <span
                className={`relative flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] transition-colors duration-300 ${current.accent.text}`}
              >
                <CurrentIcon size={12} />
              </span>
              <motion.span
                className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full transition-colors duration-300 ${current.accent.dot}`}
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </>
          ) : (
            <span className="h-6 w-6 rounded-full border border-dashed border-white/20 bg-white/[0.03]" />
          )}
        </span>
        {current ? current.label : "Choose a model"}
        <ChevronDown
          size={14}
          className={`text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={panelRef}
              role="listbox"
              aria-label="Models"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "fixed", top: coords.top, right: coords.right }}
              className={`z-50 w-60 origin-top-right rounded-2xl ${glass.solid} p-1.5`}
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                Select Model
              </p>
              {MODELS.map((model) => {
                const isSelected = model.id === selectedModel;
                const Icon = model.icon;
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => onPreviewModel?.(model.id)}
                    onMouseLeave={() => onPreviewModel?.(null)}
                    onClick={() => {
                      onSelectModel(model.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                      isSelected ? `${model.accent.softBg} text-neutral-50` : "text-neutral-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] ${model.accent.text}`}
                    >
                      <Icon size={13} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{model.label}</span>
                      <span className="block text-xs text-neutral-500">{model.provider}</span>
                    </span>
                    <AnimatePresence initial={false}>
                      {isSelected && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ duration: 0.12 }}
                          className={model.accent.text}
                        >
                          <Check size={15} strokeWidth={2.5} />
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
