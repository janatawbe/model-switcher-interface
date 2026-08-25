// Message composer: an auto-growing textarea and send button for the active model.
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

// Matches the textarea's max-h-40 class; height is grown imperatively.
const MAX_TEXTAREA_HEIGHT_PX = 160;

export function MessageInput({ selectedModel, onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const model = getModel(selectedModel);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grows the textarea to fit its content, up to the max height.
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
      {/* Same max width as MessageList, so the composer lines up with messages. */}
      <div
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl ${glass.raised} px-3 py-2.5 ring-0 transition-[box-shadow,border-color] duration-300 focus-within:border-white/[0.16] focus-within:ring-4 sm:gap-3 sm:px-4 sm:py-3 xl:max-w-4xl ${model?.accent.focusRing ?? ""} ${focused ? model?.accent.glow ?? "" : ""}`}
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
