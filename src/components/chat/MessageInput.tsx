import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

type MessageInputProps = {
  onSend: (content: string) => void;
  disabled?: boolean;
};

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-neutral-200 px-6 py-4">
      <div className="flex items-end gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 focus-within:border-neutral-400">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the assistant..."
          rows={1}
          className="max-h-40 flex-1 resize-none bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || disabled}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
