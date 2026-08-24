import { useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, RotateCcw, User } from "lucide-react";
import type { Message } from "../../types/chat";
import { getModel } from "../ui/models";
import { MarkdownContent } from "./MarkdownContent";

type MessageBubbleProps = {
  message: Message;
  grouped: boolean;
  isLatest: boolean;
  // Only meaningful (and only rendered) for an error bubble -- retrying a
  // normal assistant reply is a different action (Regenerate, below).
  onRetry?: () => void;
  // Only meaningful for the latest successful assistant reply.
  onRegenerate?: () => void;
  actionsDisabled?: boolean;
};

export function MessageBubble({ message, grouped, isLatest, onRetry, onRegenerate, actionsDisabled }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const model = getModel(message.model);
  const ModelIcon = model?.icon;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  };

  // Copy is available on any real (non-error) assistant reply, at any
  // position in the conversation -- copying an older answer is a normal
  // thing to want. Regenerate only makes sense for the single most recent
  // reply (see MessageList): regenerating an older one would silently
  // orphan everything the user said/received after it, which nothing in
  // this app currently handles.
  const showCopy = !isUser && !message.isError;
  const showRegenerate = showCopy && isLatest && !message.isStreaming && Boolean(onRegenerate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""} ${grouped ? "mt-2" : "mt-6"} first:mt-0`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        {grouped ? null : isUser ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-neutral-200">
            <User size={15} strokeWidth={2.25} />
          </div>
        ) : (
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-colors duration-300 ${model?.accent.text ?? "text-neutral-400"}`}
          >
            {ModelIcon ? <ModelIcon size={14} /> : null}
          </div>
        )}
      </div>

      {/* 65% only reads as a comfortable conversational width once there's
          enough space for it to still be a generous line length -- on a
          360px phone that's ~230px, uncomfortably narrow. Scaling the cap
          up as the viewport shrinks keeps the wrapped line length roughly
          similar across sizes instead of an ever-narrower column. */}
      <div className={`flex max-w-[88%] min-w-0 flex-col gap-1.5 sm:max-w-[80%] lg:max-w-[65%] ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && !grouped && (
          <span className={`flex items-center gap-1.5 px-1 text-[11px] font-medium tracking-wider transition-colors duration-300 ${model?.accent.text ?? "text-neutral-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${model?.accent.dot ?? "bg-neutral-500"}`} />
            {(model?.label ?? "Assistant").toUpperCase()}
          </span>
        )}
        <div
          className={`min-w-0 max-w-full break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
            isUser
              ? "whitespace-pre-wrap rounded-tr-sm border border-white/10 bg-white/[0.08] text-neutral-100 backdrop-blur-sm"
              : `rounded-tl-sm border bg-white/[0.055] py-3 text-neutral-100 backdrop-blur-sm transition-colors duration-300 ${model?.accent.border ?? "border-white/10"}`
          }`}
        >
          {isUser ? message.content : <MarkdownContent content={message.content} />}
        </div>

        {(showCopy || onRetry) && (
          <div className="flex items-center gap-3 px-1">
            {showCopy && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            {showRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={actionsDisabled}
                className="flex items-center gap-1 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-neutral-400"
              >
                <RotateCcw size={11} />
                Regenerate
              </button>
            )}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={actionsDisabled}
                className="flex items-center gap-1 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-neutral-400"
              >
                <RotateCcw size={11} />
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
