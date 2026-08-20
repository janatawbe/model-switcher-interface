import { motion } from "motion/react";
import { User } from "lucide-react";
import type { Message } from "../../types/chat";
import { getModel } from "../ui/models";

type MessageBubbleProps = {
  message: Message;
  grouped: boolean;
};

export function MessageBubble({ message, grouped }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const model = getModel(message.model);
  const ModelIcon = model?.icon;

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

      <div className={`flex max-w-[65%] flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && !grouped && (
          <span className={`flex items-center gap-1.5 px-1 text-[11px] font-medium tracking-wider transition-colors duration-300 ${model?.accent.text ?? "text-neutral-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${model?.accent.dot ?? "bg-neutral-500"}`} />
            {(model?.label ?? "Assistant").toUpperCase()}
          </span>
        )}
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
            isUser
              ? "rounded-tr-sm border border-white/10 bg-white/[0.08] text-neutral-100 backdrop-blur-sm"
              : `rounded-tl-sm border bg-white/[0.055] py-3 text-neutral-100 backdrop-blur-sm transition-colors duration-300 ${model?.accent.border ?? "border-white/10"}`
          }`}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}
