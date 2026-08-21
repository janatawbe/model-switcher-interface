import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, MessagesSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Conversation } from "../../types/chat";
import { glass } from "../ui/theme";
import { BrandMark } from "../ui/BrandMark";
import { getModelLabel } from "../ui/models";
import { DeleteConversationConfirm } from "../ui/DeleteConversationConfirm";

type SidebarProps = {
  onNewChat: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, newTitle: string) => void;
  onDeleteConversation: (conversationId: string) => void;
};

export function Sidebar({
  onNewChat,
  conversations,
  activeConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
}: SidebarProps) {
  // Most recently active conversation first -- conversations only ever
  // gain a later updatedAt by getting new messages, so this doubles as
  // "most recently used" ordering.
  const sortedConversations = [...conversations].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  const startRename = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setDraftTitle(conversation.title);
  };

  // Invalid (empty/whitespace-only) titles are silently rejected by
  // onRenameConversation itself, so committing with one just leaves the
  // stored title untouched -- same net effect as cancelling, without
  // needing separate error UI for what's a rare, low-stakes mistake.
  const commitRename = () => {
    if (editingId) onRenameConversation(editingId, draftTitle);
    setEditingId(null);
    setDraftTitle("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftTitle("");
  };

  const pendingDeleteConversation = conversations.find((c) => c.id === pendingDeleteId) ?? null;

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
              const isEditing = conversation.id === editingId;

              if (isEditing) {
                return (
                  <div
                    key={conversation.id}
                    className={`flex w-full items-center gap-1 rounded-lg ${glass.raised} py-1 pl-2.5 pr-1`}
                  >
                    <input
                      ref={editInputRef}
                      type="text"
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                        if (event.key === "Escape") cancelRename();
                      }}
                      onBlur={commitRename}
                      aria-label="Conversation title"
                      className="min-w-0 flex-1 bg-transparent py-1 text-sm font-medium text-neutral-100 outline-none"
                    />
                    <button
                      type="button"
                      // onMouseDown (not onClick) fires before the input's
                      // onBlur, so this button's own click isn't lost to a
                      // blur-triggered unmount racing the click event.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        commitRename();
                      }}
                      aria-label="Save title"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-neutral-100"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        cancelRename();
                      }}
                      aria-label="Cancel rename"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-neutral-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              }

              return (
                <div key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-lg py-2 pl-2.5 pr-14 text-left transition-colors ${
                      isActive
                        ? `${glass.raised} text-neutral-100`
                        : "border border-transparent text-neutral-400 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-neutral-200"
                    }`}
                  >
                    <span className="w-full truncate text-sm font-medium">{conversation.title || "New conversation"}</span>
                    <span className="text-[11px] text-neutral-500">{getModelLabel(conversation.model)}</span>
                  </button>

                  <div
                    className={`absolute right-1.5 top-1.5 flex items-center gap-0.5 transition-opacity ${
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        startRename(conversation);
                      }}
                      aria-label={`Rename "${conversation.title}"`}
                      title="Rename"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-neutral-100"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingDeleteId(conversation.id);
                      }}
                      aria-label={`Delete "${conversation.title}"`}
                      title="Delete"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {pendingDeleteConversation && (
          <DeleteConversationConfirm
            key="delete-conversation-confirm"
            conversationTitle={pendingDeleteConversation.title || "New conversation"}
            onConfirm={() => {
              onDeleteConversation(pendingDeleteConversation.id);
              setPendingDeleteId(null);
            }}
            onCancel={() => setPendingDeleteId(null)}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}
