import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { Message } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";
import { getModel } from "../ui/models";

type MessageListProps = {
  messages: Message[];
  isTyping: boolean;
  selectedModel: string | null;
  onRetryMessage: (messageId: string) => void;
};

export function MessageList({ messages, isTyping, selectedModel, onRetryMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const model = getModel(selectedModel);
  const ModelIcon = model?.icon;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-6">
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          grouped={index > 0 && messages[index - 1].role === message.role}
          onRetry={message.isError ? () => onRetryMessage(message.id) : undefined}
          retryDisabled={isTyping}
        />
      ))}

      {isTyping && (
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
              className={`flex items-center gap-1 rounded-2xl rounded-tl-sm border bg-white/[0.055] px-4 py-3 backdrop-blur-sm transition-colors duration-300 ${model?.accent.border ?? "border-white/10"}`}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-neutral-400"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
