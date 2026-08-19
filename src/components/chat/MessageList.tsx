import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import type { Message } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";

type MessageListProps = {
  messages: Message[];
  isTyping: boolean;
};

export function MessageList({ messages, isTyping }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isTyping]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isTyping && (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-700">
            <Bot size={16} />
          </div>
          <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-4 py-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400 [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
