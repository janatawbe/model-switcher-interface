import { motion } from "motion/react";
import { MessagesSquare, Plus } from "lucide-react";
import type { Conversation } from "../../types/chat";
import { glass } from "../ui/theme";
import { BrandMark } from "../ui/BrandMark";
import { getModelLabel } from "../ui/models";

type SidebarProps = {
  onNewChat: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
};

export function Sidebar({ onNewChat, conversations, activeConversationId, onSelectConversation }: SidebarProps) {
  // Most recently active conversation first -- conversations only ever
  // gain a later updatedAt by getting new messages, so this doubles as
  // "most recently used" ordering.
  const sortedConversations = [...conversations].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${glass.raised} text-neutral-200`}>
          <BrandMark size={16} variant="mono" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-200">
          AI Model Switcher
        </span>
      </div>

      <div className="px-3">
        <motion.button
          type="button"
          onClick={onNewChat}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className={`flex w-full items-center justify-center gap-2 rounded-xl ${glass.raised} px-3 py-2.5 text-sm font-medium text-neutral-100 transition-colors hover:border-white/[0.16] hover:bg-white/[0.09]`}
        >
          <motion.span
            className="flex items-center justify-center"
            whileHover={{ rotate: 15, scale: 1.12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <Plus size={16} strokeWidth={2.25} />
          </motion.span>
          New Chat
        </motion.button>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto px-3">
        <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          Recent
        </p>

        {sortedConversations.length === 0 ? (
          <div className="mt-4 flex flex-col items-start gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-neutral-500">
              <MessagesSquare size={15} />
            </div>
            <p className="text-sm font-medium text-neutral-400">No conversations yet</p>
            <p className="text-xs leading-relaxed text-neutral-500">
              Your conversations will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-1">
            {sortedConversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? `${glass.raised} text-neutral-100`
                      : "border border-transparent text-neutral-400 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-neutral-200"
                  }`}
                >
                  <span className="w-full truncate text-sm font-medium">{conversation.title || "New conversation"}</span>
                  <span className="text-[11px] text-neutral-500">{getModelLabel(conversation.model)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
