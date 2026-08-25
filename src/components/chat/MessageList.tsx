// Scrollable message history, including the "Thinking..." waiting indicator.
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { Message } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";
import { getModel } from "../ui/models";

type MessageListProps = {
  messages: Message[];
  isTyping: boolean;
  selectedModel: string | null;
  onRegenerateMessage: (messageId: string) => void;
};

export function MessageList({ messages, isTyping, selectedModel, onRegenerateMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const model = getModel(selectedModel);
  const ModelIcon = model?.icon;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isTyping]);

  // Once a streaming reply has actually started, the growing bubble
  // itself is the "still working" signal -- showing the separate bounce
  // dots underneath it too would be redundant. The dots are only for the
  // gap between "request sent" and "first token arrived."
  const hasStreamingMessage = messages.some((message) => message.isStreaming);
  const showWaitingIndicator = isTyping && !hasStreamingMessage;
  const lastMessageIndex = messages.length - 1;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
      {/* A readable line length matters as much on a 2560px monitor as a
          360px phone -- without this cap, bubbles would stretch toward
          their full 65% width against a multi-thousand-pixel-wide
          container on large desktop, which reads as sparse and hard to
          scan rather than spacious. The wider xl: cap only kicks in at
          1280px+ (laptop and up) -- tablet/mobile never reach either cap
          today since the available width there is already narrower, so
          this is a no-op for them. */}
      <div className="mx-auto w-full max-w-3xl xl:max-w-4xl">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            grouped={index > 0 && messages[index - 1].role === message.role}
            isLatest={index === lastMessageIndex}
            onRetry={message.isError ? () => onRegenerateMessage(message.id) : undefined}
            onRegenerate={() => onRegenerateMessage(message.id)}
            actionsDisabled={isTyping}
          />
        ))}

        {showWaitingIndicator && (
          <div className="mt-6 flex items-start gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-colors duration-300 ${model?.accent.text ?? "text-neutral-400"}`}
            >
              {ModelIcon ? <ModelIcon size={14} /> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={`flex items-center gap-1.5 px-1 text-[11px] font-medium tracking-wider transition-colors duration-300 ${model?.accent.text ?? "text-neutral-400"}`}>
                <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${model?.accent.dot ?? "bg-neutral-500"}`} />
                {(model?.label ?? "Assistant").toUpperCase()}
              </span>
              <div
                className={`flex items-center rounded-2xl rounded-tl-sm border bg-white/[0.055] px-4 py-3 text-[15px] leading-relaxed text-neutral-100 backdrop-blur-sm transition-colors duration-300 ${model?.accent.border ?? "border-white/10"}`}
              >
                <motion.span
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  Thinking...
                </motion.span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
