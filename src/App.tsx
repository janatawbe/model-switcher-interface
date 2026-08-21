import { useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Message } from "./types/chat";
import { ChatLayout } from "./components/layout/ChatLayout";
import { getModelLabel } from "./components/ui/models";
import { ModelSwitchConfirm } from "./components/ui/ModelSwitchConfirm";

type ChatApiResponse = {
  message: {
    role: "assistant";
    content: string;
    model: string;
  };
};

type ChatApiErrorBody = {
  error?: { code?: string; message?: string };
};

// Maps our backend's error categories (see server/src/types/ai.ts) to a
// calm, model-aware sentence for the chat bubble -- never the raw
// provider response. Works for any model automatically since it's keyed
// off the error code, not the model itself; anything not explicitly
// classified below keeps the original generic fallback.
function describeFailure(code: string | undefined, modelId: string): string {
  const label = getModelLabel(modelId);
  switch (code) {
    case "AI_RATE_LIMITED":
      return `${label} is temporarily rate-limited by its provider. Please try again in a moment.`;
    case "AI_PROVIDER_UNAVAILABLE":
      return `${label}'s provider is temporarily unavailable due to high demand. Please try again shortly.`;
    case "AI_AUTH_ERROR":
    case "MISSING_API_KEY":
      return `There's a configuration issue reaching ${label} right now. Please try again later.`;
    default:
      return "Something went wrong reaching the model. Please try again.";
  }
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  // A model the user picked while a conversation was already in progress --
  // held here until they confirm, rather than switched immediately, so an
  // in-progress chat is never silently reattributed to a different model.
  const [pendingModel, setPendingModel] = useState<string | null>(null);

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

    // Only reassigned once we've actually classified a response from our
    // own backend -- any other failure (network error, unreadable JSON,
    // etc.) leaves this at the safe, generic default.
    let userFacingMessage = "Something went wrong reaching the model. Please try again.";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        // The chat bubble only ever shows a short, honest category message
        // (see describeFailure) -- the full detail a developer needs to
        // diagnose a model-specific failure goes to the console, not the UI.
        const errorBody = (await response.json().catch(() => null)) as ChatApiErrorBody | null;
        console.error("Chat request failed:", response.status, errorBody);
        userFacingMessage = describeFailure(errorBody?.error?.code, selectedModel);
        throw new Error("Chat request failed");
      }

      const data = (await response.json()) as ChatApiResponse;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message.content,
        model: data.message.model,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: userFacingMessage,
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

  // The single gate every model-select action passes through (the header
  // dropdown and the welcome screen's cards both just call this, unchanged).
  // Switching is only ever immediate when there's nothing to lose yet -- no
  // model chosen, or a model chosen but no messages sent. Once a
  // conversation is actually underway, the switch is held pending
  // confirmation instead of applied right away.
  const requestModelSwitch = (modelId: string) => {
    if (modelId === selectedModel) return;
    if (selectedModel === null || messages.length === 0) {
      setSelectedModel(modelId);
      return;
    }
    setPendingModel(modelId);
  };

  const confirmModelSwitch = () => {
    if (!pendingModel) return;
    setSelectedModel(pendingModel);
    setMessages([]);
    setIsTyping(false);
    setPendingModel(null);
  };

  const cancelModelSwitch = () => setPendingModel(null);

  return (
    <>
      <ChatLayout
        messages={messages}
        isTyping={isTyping}
        selectedModel={selectedModel}
        onSelectModel={requestModelSwitch}
        onNewChat={handleNewChat}
        onSendMessage={handleSendMessage}
      />
      <AnimatePresence>
        {pendingModel && selectedModel && (
          <ModelSwitchConfirm
            key="model-switch-confirm"
            fromModelId={selectedModel}
            toModelId={pendingModel}
            onConfirm={confirmModelSwitch}
            onCancel={cancelModelSwitch}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
