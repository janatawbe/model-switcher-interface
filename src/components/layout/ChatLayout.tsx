// Top-level chat shell: switches between the welcome screen and the
// sidebar/header/messages/composer layout based on whether a model is selected.
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Conversation, Message } from "../../types/chat";
import { EmptyState } from "../chat/EmptyState";
import { MessageInput } from "../chat/MessageInput";
import { MessageList } from "../chat/MessageList";
import { Sidebar } from "./Sidebar";
import { ChatHeader } from "./ChatHeader";
import { Aurora } from "./Aurora";
import { WelcomeScreen } from "./WelcomeScreen";

type ChatLayoutProps = {
  messages: Message[];
  isTyping: boolean;
  selectedModel: string | null;
  onSelectModel: (modelId: string) => void;
  onNewChat: () => void;
  onSendMessage: (content: string) => void;
  onRegenerateMessage: (messageId: string) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, newTitle: string) => void;
  onDeleteConversation: (conversationId: string) => void;
};

// Shows the full-screen welcome screen until a model is chosen.
export function ChatLayout({
  messages,
  isTyping,
  selectedModel,
  onSelectModel,
  onNewChat,
  onSendMessage,
  onRegenerateMessage,
  conversations,
  activeConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
}: ChatLayoutProps) {
  const hasMessages = messages.length > 0;
  const [previewModel, setPreviewModel] = useState<string | null>(null);
  // Sidebar starts open on tablet+ and collapsed on phone-sized screens.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches,
  );
  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const conversationTitle = activeConversation?.title || "New Conversation";

  return (
    <AnimatePresence mode="wait">
      {selectedModel === null ? (
        <motion.div
          key="welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="h-screen w-screen"
        >
          <WelcomeScreen previewModel={previewModel} onSelectModel={onSelectModel} onPreviewModel={setPreviewModel} />
        </motion.div>
      ) : (
        <motion.div
          key="chat"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="relative h-screen w-screen overflow-hidden bg-[#08090d] text-neutral-100"
        >
          <Aurora activeModel={selectedModel} previewModel={previewModel} />

          <div className="relative z-10 flex h-full w-full">
            <Sidebar
              onNewChat={onNewChat}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={onSelectConversation}
              onRenameConversation={onRenameConversation}
              onDeleteConversation={onDeleteConversation}
              isOpen={sidebarOpen}
              onToggleOpen={() => setSidebarOpen((open) => !open)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
              <ChatHeader
                title={conversationTitle}
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
                onPreviewModel={setPreviewModel}
              />

              <div className="min-h-0 flex-1">
                <AnimatePresence mode="wait">
                  {hasMessages ? (
                    <motion.div
                      key="messages"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="h-full"
                    >
                      <MessageList
                        messages={messages}
                        isTyping={isTyping}
                        selectedModel={selectedModel}
                        onRegenerateMessage={onRegenerateMessage}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="h-full"
                    >
                      <EmptyState
                        selectedModel={selectedModel}
                        previewModel={previewModel}
                        onSuggestionSelect={onSendMessage}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <MessageInput selectedModel={selectedModel} onSend={onSendMessage} disabled={isTyping} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
