import type { Message } from "../../types/chat";
import { EmptyState } from "../chat/EmptyState";
import { MessageInput } from "../chat/MessageInput";
import { MessageList } from "../chat/MessageList";
import { Sidebar } from "./Sidebar";
import { ChatHeader } from "./ChatHeader";

type ChatLayoutProps = {
  messages: Message[];
  isTyping: boolean;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  onNewChat: () => void;
  onSendMessage: (content: string) => void;
};

export function ChatLayout({
  messages,
  isTyping,
  selectedModel,
  onSelectModel,
  onNewChat,
  onSendMessage,
}: ChatLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar onNewChat={onNewChat} />

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader selectedModel={selectedModel} onSelectModel={onSelectModel} />

        <div className="min-h-0 flex-1">
          {messages.length === 0 ? (
            <EmptyState onSuggestionSelect={onSendMessage} />
          ) : (
            <MessageList messages={messages} isTyping={isTyping} />
          )}
        </div>

        <MessageInput onSend={onSendMessage} disabled={isTyping} />
      </div>
    </div>
  );
}
