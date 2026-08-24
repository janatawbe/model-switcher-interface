import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { getModel } from "../ui/models";
import { glass } from "../ui/theme";

type MessageInputProps = {
  selectedModel: string | null;
  onSend: (content: string) => void;
  disabled?: boolean;
};

// Matches the textarea's existing max-h-40 (10rem) Tailwind class -- kept
// as a real number here since growing the box to fit its content has to
// happen imperatively (a textarea's height never tracks its own content
// through CSS alone), and this is the ceiling that decision is capped at.
const MAX_TEXTAREA_HEIGHT_PX = 160;

export function MessageInput({ selectedModel, onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const model = getModel(selectedModel);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grows the box to fit whatever's actually typed or pasted, capped at
  // MAX_TEXTAREA_HEIGHT_PX (matching max-h-40 below) where it switches to
  // its own internal scroll instead of growing further. Resetting to
  // "auto" first (rather than reading scrollHeight directly against
  // whatever height is currently set) is what lets this shrink back down
  // too -- e.g. after Send clears the value, or the user deletes pasted
  // text -- not just grow.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || !selectedModel) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const canSend = Boolean(value.trim()) && !disabled && selectedModel !== null;

  return (
    <div className="shrink-0 px-3 py-3 sm:px-6 sm:py-4">
      {/* Same max-w-3xl as MessageList, so the composer lines up under the
          conversation above it instead of stretching wider on large
          desktop while the messages it's replying to stay narrower. */}
      <div
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl ${glass.raised} px-3 py-2.5 ring-0 transition-[box-shadow,border-color] duration-300 focus-within:border-white/[0.16] focus-within:ring-4 sm:gap-3 sm:px-4 sm:py-3 ${model?.accent.focusRing ?? ""} ${focused ? model?.accent.glow ?? "" : ""}`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedModel ? "Ask anything..." : "Choose a model to begin..."}
          rows={1}
          aria-label="Message"
          className="max-h-40 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent text-[15px] text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        {model && (
          <span className={`hidden select-none text-xs font-medium tracking-wide transition-colors duration-300 sm:inline ${model.accent.text}`}>
            {model.label.toUpperCase()}
          </span>
        )}
        <motion.button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
          whileTap={canSend ? { scale: 0.9 } : undefined}
          transition={{ duration: 0.1 }}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-neutral-600 ${
            canSend ? (model?.accent.solidButton ?? "bg-white/10 text-neutral-100") : "bg-white/[0.05] text-neutral-500"
          }`}
        >
          <ArrowUp size={16} strokeWidth={2.25} />
        </motion.button>
      </div>
    </div>
  );
}
