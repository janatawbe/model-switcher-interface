import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Conversation, Message } from "./types/chat";
import { ChatLayout } from "./components/layout/ChatLayout";
import { getModelLabel } from "./components/ui/models";
import { ModelSwitchConfirm } from "./components/ui/ModelSwitchConfirm";
import { loadState, saveState } from "./lib/storage";

type ChatApiResponse = {
  message: {
    role: "assistant";
    content: string;
    model: string;
  };
};

type ChatApiErrorBody = {
  error?: { code?: string; message?: string; resetAt?: string };
};

// Turns a reset timestamp into a short, safe phrase -- "in about 45
// seconds" for a near-term reset, "after 2:35 PM" (optionally "tomorrow")
// for a same-/next-day one. Returns null whenever the timestamp can't be
// trusted (already passed, or far enough out that a bare clock time would
// be ambiguous) so the caller can fall back to the generic message instead
// of showing something potentially misleading.
function formatRetryHint(resetAtIso: string): string | null {
  const resetMs = Date.parse(resetAtIso);
  if (!Number.isFinite(resetMs)) return null;

  const deltaMs = resetMs - Date.now();
  if (deltaMs <= 0) return null;

  const deltaSeconds = deltaMs / 1000;
  if (deltaSeconds <= 120) {
    const rounded = Math.max(5, Math.round(deltaSeconds / 5) * 5);
    return `in about ${rounded} second${rounded === 1 ? "" : "s"}`;
  }

  const deltaMinutes = Math.round(deltaMs / 60000);
  if (deltaMinutes <= 60) {
    return `in about ${deltaMinutes} minute${deltaMinutes === 1 ? "" : "s"}`;
  }

  const resetDate = new Date(resetMs);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const isSameDay = resetDate.toDateString() === now.toDateString();
  const isTomorrow = resetDate.toDateString() === tomorrow.toDateString();
  if (!isSameDay && !isTomorrow) return null;

  const timeLabel = resetDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return isSameDay ? `after ${timeLabel}` : `after ${timeLabel} tomorrow`;
}

// Maps our backend's error categories (see server/src/types/ai.ts) to a
// calm, model-aware sentence for the chat bubble -- never the raw
// provider response. Works for any model automatically since it's keyed
// off the error code, not the model itself; anything not explicitly
// classified below keeps the original generic fallback.
function describeFailure(code: string | undefined, modelId: string, resetAt?: string): string {
  const label = getModelLabel(modelId);
  switch (code) {
    case "AI_RATE_LIMITED": {
      const hint = resetAt ? formatRetryHint(resetAt) : null;
      return hint
        ? `${label} is temporarily rate-limited by its provider. Please try again ${hint}.`
        : `${label} is temporarily rate-limited by its provider. Please try again in a moment.`;
    }
    case "AI_PROVIDER_UNAVAILABLE":
      return `${label}'s provider is temporarily unavailable due to high demand. Please try again shortly.`;
    case "AI_MODEL_UNAVAILABLE":
      return `${label} is temporarily unavailable right now. Please try again later or choose a different model.`;
    case "AI_AUTH_ERROR":
    case "MISSING_API_KEY":
      return `There's a configuration issue reaching ${label} right now. Please try again later.`;
    default:
      return "Something went wrong reaching the model. Please try again.";
  }
}

// Read once, synchronously, on module init -- both pieces of restored
// state (the conversations and which one was active) come from the same
// snapshot, and a conversation only ever gets created once it has at
// least one message (see handleSendMessage), so an active id that no
// longer resolves to anything in the array means "nothing to restore",
// not "corrupt". If the saved active id doesn't resolve, fall back to
// the most recently updated conversation (if any exist) rather than a
// blank welcome screen, so restored history stays reachable through the
// sidebar instead of stranding it behind a screen that can't show it.
function restoreInitialState() {
  const { conversations, activeConversationId } = loadState();
  if (activeConversationId && conversations.some((c) => c.id === activeConversationId)) {
    return { conversations, activeConversationId };
  }
  const mostRecent = conversations.reduce<Conversation | null>(
    (latest, c) => (!latest || c.updatedAt > latest.updatedAt ? c : latest),
    null,
  );
  return { conversations, activeConversationId: mostRecent?.id ?? null };
}

function App() {
  const [initial] = useState(restoreInitialState);
  const [conversations, setConversations] = useState<Conversation[]>(initial.conversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initial.activeConversationId);
  // A model chosen before any message has been sent -- nothing worth
  // persisting yet, so it lives here rather than as a Conversation until
  // the first message materializes one (see handleSendMessage).
  const [draftModel, setDraftModel] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  // A model the user picked while a conversation was already in progress --
  // held here until they confirm, rather than switched immediately, so an
  // in-progress chat is never silently reattributed to a different model.
  const [pendingModel, setPendingModel] = useState<string | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const selectedModel = activeConversation?.model ?? draftModel;
  const messages = activeConversation?.messages ?? [];

  // The only place conversations are written to localStorage -- fires
  // when the conversation set or the active id actually changes, not on
  // every render (draftModel/isTyping/pendingModel churn doesn't touch
  // this effect's dependencies).
  useEffect(() => {
    saveState({ conversations, activeConversationId });
  }, [conversations, activeConversationId]);

  const appendToConversation = (conversationId: string, next: Message[]) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, messages: next, updatedAt: new Date().toISOString() } : c,
      ),
    );
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedModel) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    // Explicitly built from the current `messages` (existing messages +
    // the message just created above), not relied on after a state
    // update -- state updates are async, so re-reading state later could
    // still see the pre-send value and either drop the new message or,
    // after a re-render, send it twice.
    const history = [...messages, userMessage];

    let conversationId = activeConversationId;
    if (conversationId === null) {
      // First message of a fresh draft -- this is the point a
      // conversation actually gets created and persisted.
      conversationId = crypto.randomUUID();
      const now = new Date().toISOString();
      const newConversation: Conversation = {
        id: conversationId,
        title: content.slice(0, 60),
        model: selectedModel,
        messages: history,
        createdAt: now,
        updatedAt: now,
      };
      setConversations((prev) => [newConversation, ...prev]);
      setActiveConversationId(conversationId);
      setDraftModel(null);
    } else {
      appendToConversation(conversationId, history);
    }

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
          // Error notices are excluded: they're a local UI notice, not
          // something the model actually said, and sending them back as
          // context would make the model think it produced that text itself.
          messages: history.filter((message) => !message.isError).map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        // The chat bubble only ever shows a short, honest category message
        // (see describeFailure) -- the full detail a developer needs to
        // diagnose a model-specific failure goes to the console, not the UI.
        const errorBody = (await response.json().catch(() => null)) as ChatApiErrorBody | null;
        console.error("Chat request failed:", response.status, errorBody);
        userFacingMessage = describeFailure(errorBody?.error?.code, selectedModel, errorBody?.error?.resetAt);
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
      appendToConversation(conversationId, [...history, assistantMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: userFacingMessage,
        model: selectedModel,
        createdAt: new Date().toISOString(),
        isError: true,
      };
      appendToConversation(conversationId, [...history, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Leaves the current conversation (already persisted, since it can only
  // become active with at least one message in it) untouched in the list
  // and returns to a fresh draft on the same model. A no-op if already on
  // an empty draft, so repeated clicks can't create empty duplicates.
  const handleNewChat = () => {
    if (activeConversationId === null) return;
    setDraftModel(activeConversation?.model ?? null);
    setActiveConversationId(null);
    setIsTyping(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    if (conversationId === activeConversationId) return;
    setPendingModel(null);
    setDraftModel(null);
    setActiveConversationId(conversationId);
    setIsTyping(false);
  };

  // The single gate every model-select action passes through (the header
  // dropdown and the welcome screen's cards both just call this, unchanged).
  // Switching is only ever immediate when there's nothing to lose yet --
  // no active conversation, since a conversation is never created without
  // at least one message in it. Once a conversation actually exists, the
  // switch is held pending confirmation instead of applied right away.
  const requestModelSwitch = (modelId: string) => {
    if (modelId === selectedModel) return;
    if (activeConversationId === null) {
      setDraftModel(modelId);
      return;
    }
    setPendingModel(modelId);
  };

  const confirmModelSwitch = () => {
    if (!pendingModel) return;
    setDraftModel(pendingModel);
    setActiveConversationId(null);
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
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
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
