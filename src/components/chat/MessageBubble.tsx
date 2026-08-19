import { Bot, User } from "lucide-react";
import type { Message } from "../../types/chat";
import { getModelLabel } from "../ui/models";

type MessageBubbleProps = {
  message: Message;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-700"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={`flex max-w-[65%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && (
          <span className="px-1 text-xs font-medium text-neutral-400">
            {getModelLabel(message.model)}
          </span>
        )}
        <div
          className={`whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-2xl rounded-tr-sm bg-neutral-900 text-white"
              : "rounded-2xl rounded-tl-sm border border-neutral-200 bg-white text-neutral-800"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
