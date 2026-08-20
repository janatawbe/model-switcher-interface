import { useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { getModel } from "../ui/models";
import { glass } from "../ui/theme";

type MessageInputProps = {
  selectedModel: string | null;
  onSend: (content: string) => void;
  disabled?: boolean;
};

export function MessageInput({ selectedModel, onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const model = getModel(selectedModel);

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
    <div className="shrink-0 px-6 py-4">
      <div
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`flex items-end gap-3 rounded-2xl ${glass.raised} px-4 py-3 ring-0 transition-[box-shadow,border-color] duration-300 focus-within:border-white/[0.16] focus-within:ring-4 ${model?.accent.focusRing ?? ""} ${focused ? model?.accent.glow ?? "" : ""}`}
      >
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedModel ? "Ask anything..." : "Choose a model to begin..."}
          rows={1}
          aria-label="Message"
          className="max-h-40 flex-1 resize-none bg-transparent text-[15px] text-neutral-100 outline-none placeholder:text-neutral-500"
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
