import { useState } from "react";
import type { Message } from "./types/chat";
import { ChatLayout } from "./components/layout/ChatLayout";
import { MODELS } from "./components/ui/models";

const FAKE_REPLIES = [
  "This is a demo response.",
  "Got it — this is placeholder output until a real model is wired up.",
  "Here's a fake reply so we can test the chat flow.",
];

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: FAKE_REPLIES[Math.floor(Math.random() * FAKE_REPLIES.length)],
        model: selectedModel,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 700);
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
