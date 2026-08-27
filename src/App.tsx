// Owns conversation state, persistence, model switching, and chat requests.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Conversation, Message } from "./types/chat";
import { ChatLayout } from "./components/layout/ChatLayout";
import { getModelLabel } from "./components/ui/models";
import { ModelSwitchConfirm } from "./components/ui/ModelSwitchConfirm";
import { loadState, saveState } from "./lib/storage";

type ChatApiErrorBody = {
  error?: { code?: string; message?: string; resetAt?: string };
};

// Event shapes sent by /api/chat's streamed response.
type ChatStreamEvent =
  | { type: "chunk"; content: string; model: string }
  | { type: "status"; message: string }
  | { type: "done" }
  | { type: "error"; code?: string; message?: string; resetAt?: string };

// Turns a reset timestamp into a short phrase like "in about 45 seconds".
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

// Maps a backend error code to a calm, model-aware message for the bubble.
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

const MAX_TITLE_LENGTH = 60;
// Background title generation shouldn't hold things up as long as a real reply would.
const TITLE_REQUEST_TIMEOUT_MS = 20000;
// Floor so "Searching the web..." doesn't flash away instantly on a very fast search.
const MIN_SEARCH_STATUS_VISIBLE_MS = 400;
// How long to hold back ordinary text before we assume no web search is coming and
// start streaming it live. If a "status" event arrives first (fast or slow), the
// existing reset-on-status logic below discards it regardless of this timing.
// Generous on purpose: some models write several sentences before deciding to
// search, and a status event (not this timeout) is what resolves the common case.
const PRE_SEARCH_BUFFER_TIMEOUT_MS = 3000;

// Local, instant fallback title; stays if automatic title generation fails.
function deriveFallbackTitle(rawContent: string): string {
  const cleaned = rawContent.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New Conversation";
  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned;

  const truncated = cleaned.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  // Break on a word boundary unless that would cut off too much.
  const boundary = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  return `${boundary.trimEnd()}…`;
}

// Catches models that narrate their reasoning instead of giving a title.
const REASONING_PREAMBLE_PATTERN =
  /^(we need to|let me|i should|i'll|i will|first,|okay,|sure,|the title is|here is|here's|this conversation is about)\b/i;

// Cleans up a generated title; returns null if it doesn't look usable.
function sanitizeGeneratedTitle(raw: string): string | null {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  cleaned = cleaned.replace(/[.!?]+$/, "").trim();
  // A real title is one short line.
  if (!cleaned || cleaned.includes("\n") || cleaned.length > 80) return null;
  if (REASONING_PREAMBLE_PATTERN.test(cleaned)) return null;
  return cleaned;
}

// Finds the most recently updated conversation, used as a fallback to land on.
function findMostRecentConversation(conversations: Conversation[]): Conversation | null {
  return conversations.reduce<Conversation | null>(
    (latest, c) => (!latest || c.updatedAt > latest.updatedAt ? c : latest),
    null,
  );
}

// Restores saved conversations; falls back to the most recent one if needed.
function restoreInitialState() {
  const { conversations, activeConversationId } = loadState();
  if (activeConversationId && conversations.some((c) => c.id === activeConversationId)) {
    return { conversations, activeConversationId };
  }
  return { conversations, activeConversationId: findMostRecentConversation(conversations)?.id ?? null };
}

function App() {
  const [initial] = useState(restoreInitialState);
  const [conversations, setConversations] = useState<Conversation[]>(initial.conversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initial.activeConversationId);
  // Model chosen before any message is sent; not yet a real conversation.
  const [draftModel, setDraftModel] = useState<string | null>(null);
  // Conversations with a request in flight, keyed by id.
  const [pendingConversationIds, setPendingConversationIds] = useState<Set<string>>(new Set());
  // Waiting-indicator label per conversation (e.g. "Searching the web..."); defaults to "Thinking...".
  const [waitingStatusByConversation, setWaitingStatusByConversation] = useState<Map<string, string>>(new Map());
  // Synchronous guard against double-sends before React re-renders.
  const sendGuardRef = useRef<Set<string>>(new Set());
  // Model picked mid-conversation, held until the user confirms the switch.
  const [pendingModel, setPendingModel] = useState<string | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const selectedModel = activeConversation?.model ?? draftModel;
  const messages = activeConversation?.messages ?? [];
  const isTyping = activeConversationId !== null && pendingConversationIds.has(activeConversationId);
  const waitingLabel = (activeConversationId && waitingStatusByConversation.get(activeConversationId)) || "Thinking...";

  // Saves conversations to localStorage, debounced to avoid writing on every streamed chunk.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveState({ conversations, activeConversationId });
    }, 250);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [conversations, activeConversationId]);

  // Updates one conversation by id; a no-op if it no longer exists.
  const updateConversation = (conversationId: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? updater(c) : c)));
  };

  const appendToConversation = (conversationId: string, next: Message[]) => {
    updateConversation(conversationId, (c) => ({ ...c, messages: next, updatedAt: new Date().toISOString() }));
  };

  // Grows a streaming message's content in place as chunks arrive.
  const updateMessageContent = (conversationId: string, messageId: string, content: string) => {
    updateConversation(conversationId, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
    }));
  };

  // Marks a message as no longer streaming once it settles.
  const markMessageSettled = (conversationId: string, messageId: string) => {
    updateConversation(conversationId, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === messageId ? { ...m, isStreaming: false } : m)),
    }));
  };

  // Upgrades the fallback title to a generated one; failures are silent.
  const requestTitleGeneration = async (
    conversationId: string,
    model: string,
    userText: string,
    assistantText: string,
  ) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TITLE_REQUEST_TIMEOUT_MS);

    // Skips the update if the title was already locked (e.g. by a manual rename).
    const finalize = (newTitle?: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId && !c.titleFinal
            ? { ...c, title: newTitle ?? c.title, titleFinal: true }
            : c,
        ),
      );
    };

    try {
      const response = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, userMessage: userText, assistantMessage: assistantText }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Title generation request failed (${response.status})`);

      const data = (await response.json()) as { title?: string };
      const sanitized = typeof data.title === "string" ? sanitizeGeneratedTitle(data.title) : null;
      if (!sanitized) throw new Error("Title generation returned an unusable title");

      finalize(sanitized);
    } catch (error) {
      console.error("Automatic title generation failed, keeping the existing title:", error);
      finalize();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Sends a chat request and streams the reply into the given conversation.
  const requestAssistantReply = async (conversationId: string, model: string, history: Message[]) => {
    setPendingConversationIds((prev) => new Set(prev).add(conversationId));

    let userFacingMessage = "Something went wrong reaching the model. Please try again.";
    // Set once the first chunk arrives, so a later error keeps partial content visible.
    let streamingMessageId: string | null = null;
    let accumulatedContent = "";
    // When the "Searching the web..." status was shown, so it stays visible for a
    // moment even if the final answer starts streaming almost immediately after.
    let searchStatusShownAt: number | null = null;
    // Holds text streamed before we know whether the model will call web_search, so a
    // preamble (e.g. "Based on my training data...") never appears before "Searching
    // the web..." does. Discarded on a status event; flushed live after a short wait.
    let preSearchBuffer = "";
    let preSearchBufferStartedAt: number | null = null;
    let isBuffering = true;

    // Settles the message, then triggers title generation if this was the first reply.
    const settleWithRealReply = (targetConversationId: string, messageId: string) => {
      markMessageSettled(targetConversationId, messageId);
      const isFirstReply = !history.some((m) => m.role === "assistant" && !m.isError);
      if (isFirstReply) {
        const triggeringUserMessage = history[history.length - 1];
        void requestTitleGeneration(targetConversationId, model, triggeringUserMessage.content, accumulatedContent);
      }
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          // Error notices are excluded; they're local UI, not something the model said.
          messages: history.filter((message) => !message.isError).map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        // Pre-stream failure: a normal JSON error body, not a stream event.
        const errorBody = (await response.json().catch(() => null)) as ChatApiErrorBody | null;
        console.error("Chat request failed:", response.status, errorBody);
        userFacingMessage = describeFailure(errorBody?.error?.code, model, errorBody?.error?.resetAt);
        throw new Error("Chat request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming is not supported by this browser");

      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: { code?: string; message?: string; resetAt?: string } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: ChatStreamEvent;
          try {
            event = JSON.parse(trimmed) as ChatStreamEvent;
          } catch {
            continue; // skip malformed lines
          }

          if (event.type === "chunk") {
            if (isBuffering) {
              if (preSearchBufferStartedAt === null) preSearchBufferStartedAt = Date.now();
              if (Date.now() - preSearchBufferStartedAt < PRE_SEARCH_BUFFER_TIMEOUT_MS) {
                preSearchBuffer += event.content;
                continue; // held back until a status event or the timeout resolves it
              }
              // No status event within the wait -- treat this as a normal reply and
              // start streaming what's buffered so far, live, from here on.
              isBuffering = false;
              accumulatedContent = preSearchBuffer;
              preSearchBuffer = "";
            }

            // Keep "Searching the web..." visible for a moment rather than letting it
            // flash away instantly if the answer starts streaming right behind it --
            // whether that's the very first chunk, or the first chunk after a status
            // event reset the bubble (see the "status" branch below).
            if (accumulatedContent === "" && searchStatusShownAt !== null) {
              const remaining = MIN_SEARCH_STATUS_VISIBLE_MS - (Date.now() - searchStatusShownAt);
              if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
            }
            accumulatedContent += event.content;
            if (streamingMessageId === null) {
              streamingMessageId = crypto.randomUUID();
              const streamingMessage: Message = {
                id: streamingMessageId,
                role: "assistant",
                content: accumulatedContent,
                model: event.model,
                createdAt: new Date().toISOString(),
                isStreaming: true,
              };
              appendToConversation(conversationId, [...history, streamingMessage]);
            } else {
              updateMessageContent(conversationId, streamingMessageId, accumulatedContent);
            }
          } else if (event.type === "status") {
            setWaitingStatusByConversation((prev) => new Map(prev).set(conversationId, event.message));
            searchStatusShownAt = Date.now();
            isBuffering = false;
            preSearchBuffer = "";
            preSearchBufferStartedAt = null;
            // A model may stream a short preamble (e.g. "I'll search for that...") before
            // deciding to search; once that happens the waiting indicator is already
            // hidden behind that bubble, so show the status there instead of leaving
            // stale preamble text up while the search runs.
            if (streamingMessageId !== null) {
              accumulatedContent = "";
              updateMessageContent(conversationId, streamingMessageId, event.message);
            }
          } else if (event.type === "error") {
            streamError = { code: event.code, message: event.message, resetAt: event.resetAt };
          }
        }
      }

      // The whole reply finished while still buffered (short, no search) -- show it now.
      if (isBuffering && preSearchBuffer.length > 0 && streamingMessageId === null) {
        accumulatedContent = preSearchBuffer;
        streamingMessageId = crypto.randomUUID();
        const streamingMessage: Message = {
          id: streamingMessageId,
          role: "assistant",
          content: accumulatedContent,
          model,
          createdAt: new Date().toISOString(),
          isStreaming: true,
        };
        appendToConversation(conversationId, [...history, streamingMessage]);
      }

      if (streamError) {
        if (streamingMessageId && accumulatedContent.length > 0) {
          console.error("Stream interrupted after partial content:", streamError);
          settleWithRealReply(conversationId, streamingMessageId);
        } else {
          userFacingMessage = describeFailure(streamError.code, model, streamError.resetAt);
          throw new Error("Chat stream failed");
        }
      } else if (streamingMessageId) {
        settleWithRealReply(conversationId, streamingMessageId);
      } else {
        // Shouldn't normally happen; treated like any other failure.
        throw new Error("Empty response stream");
      }
    } catch (error) {
      console.error("Failed to get a response:", error);
      if (streamingMessageId && accumulatedContent.length > 0) {
        settleWithRealReply(conversationId, streamingMessageId);
      } else {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: userFacingMessage,
          model,
          createdAt: new Date().toISOString(),
          isError: true,
        };
        appendToConversation(conversationId, [...history, errorMessage]);
      }
    } finally {
      setPendingConversationIds((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
      setWaitingStatusByConversation((prev) => {
        if (!prev.has(conversationId)) return prev;
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
    }
  };

  const handleSendMessage = (content: string) => {
    if (!selectedModel) return;

    // Blocks a duplicate send before the disabled input re-renders.
    const guardKey = activeConversationId ?? "__draft__";
    if (sendGuardRef.current.has(guardKey)) return;
    sendGuardRef.current.add(guardKey);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    // Built from current state directly, since state updates are async.
    const history = [...messages, userMessage];

    let conversationId = activeConversationId;
    if (conversationId === null) {
      // First message of a draft creates and persists the conversation.
      conversationId = crypto.randomUUID();
      const now = new Date().toISOString();
      const newConversation: Conversation = {
        id: conversationId,
        title: deriveFallbackTitle(content),
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

    void requestAssistantReply(conversationId, selectedModel, history).finally(() => {
      sendGuardRef.current.delete(guardKey);
    });
  };

  // Used by both Retry and Regenerate: replaces one reply in place.
  const handleRegenerateMessage = (assistantMessageId: string) => {
    if (!activeConversation || !selectedModel) return;
    if (sendGuardRef.current.has(activeConversation.id)) return;

    const targetIndex = activeConversation.messages.findIndex((m) => m.id === assistantMessageId);
    if (targetIndex <= 0) return;
    const triggerMessage = activeConversation.messages[targetIndex - 1];
    if (triggerMessage.role !== "user") return;

    const history = activeConversation.messages.slice(0, targetIndex);
    appendToConversation(activeConversation.id, history);

    const conversationId = activeConversation.id;
    sendGuardRef.current.add(conversationId);
    void requestAssistantReply(conversationId, selectedModel, history).finally(() => {
      sendGuardRef.current.delete(conversationId);
    });
  };

  // Returns to a fresh draft on the same model, without touching history.
  const handleNewChat = () => {
    if (activeConversationId === null) return;
    setDraftModel(activeConversation?.model ?? null);
    setActiveConversationId(null);
  };

  // isTyping is derived from pendingConversationIds, so loading state follows automatically.
  const handleSelectConversation = (conversationId: string) => {
    if (conversationId === activeConversationId) return;
    setPendingModel(null);
    setDraftModel(null);
    setActiveConversationId(conversationId);
  };

  // Renames without reordering the sidebar; locks out automatic titles.
  const handleRenameConversation = (conversationId: string, newTitle: string) => {
    const cleaned = newTitle.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, title: cleaned, titleFinal: true } : c)),
    );
  };

  const handleDeleteConversation = (conversationId: string) => {
    const remaining = conversations.filter((c) => c.id !== conversationId);
    setConversations(remaining);

    if (conversationId !== activeConversationId) return;

    // Land on the next most recent conversation, or the welcome screen.
    setActiveConversationId(findMostRecentConversation(remaining)?.id ?? null);
    setDraftModel(null);
    setPendingModel(null);
  };

  // Switches immediately if there's no active conversation to lose; else asks for confirmation.
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
    setPendingModel(null);
  };

  const cancelModelSwitch = () => setPendingModel(null);

  return (
    <>
      <ChatLayout
        messages={messages}
        isTyping={isTyping}
        waitingLabel={waitingLabel}
        selectedModel={selectedModel}
        onSelectModel={requestModelSwitch}
        onNewChat={handleNewChat}
        onSendMessage={handleSendMessage}
        onRegenerateMessage={handleRegenerateMessage}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
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
