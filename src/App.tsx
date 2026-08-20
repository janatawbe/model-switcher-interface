import { useState } from "react";
import type { Message } from "./types/chat";
import { ChatLayout } from "./components/layout/ChatLayout";

type ChatApiResponse = {
  message: {
    role: "assistant";
    content: string;
    model: string;
  };
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = async (content: string) => {
    if (!selectedModel) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const history = [...messages, userMessage];
    setMessages(history);
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const data = (await response.json()) as ChatApiResponse;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message.content,
        model: data.message.model,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Something went wrong reaching the model. Please try again.",
        model: selectedModel,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setIsTyping(false);
  };

  return (
    <ChatLayout
      messages={messages}
      isTyping={isTyping}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      onNewChat={handleNewChat}
      onSendMessage={handleSendMessage}
    />
  );
}

export default App;
