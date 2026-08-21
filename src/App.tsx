import { useEffect, useRef, useState } from "react";
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

const MAX_TITLE_LENGTH = 60;

// Derives a short sidebar title from the first user message, entirely
// locally (no model call). Deliberately just cleans and truncates rather
// than attempting a semantic rewrite -- a regex-based "rewrite" would
// mangle arbitrary phrasing/grammar unpredictably, which is worse than a
// faithful (if plain) excerpt of what the user actually typed.
function generateTitle(rawContent: string): string {
  const cleaned = rawContent.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New Conversation";
  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned;

  const truncated = cleaned.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  // Only break on a word boundary if it doesn't throw away most of the
  // budget -- otherwise a title with one long leading word would get cut
  // down to almost nothing.
  const boundary = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  return `${boundary.trimEnd()}…`;
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
  // Which conversations currently have a request in flight -- keyed by
  // conversation id rather than a single flag, since a request keeps
  // running in the background after the user switches away from it (see
  // requestAssistantReply), and a later-finishing unrelated request must
  // never be able to clear the loading indicator for whichever
  // conversation happens to be active *now*. The visible "isTyping" below
  // is just membership of the currently active conversation in this set,
  // so switching to/from a conversation always reflects its own real
  // in-flight status with no manual bookkeeping needed elsewhere.
  const [pendingConversationIds, setPendingConversationIds] = useState<Set<string>>(new Set());
  // Mirrors pendingConversationIds but read/written synchronously, purely
  // to reject a second send for the same conversation (or the same draft)
  // that arrives before React has re-rendered with the disabled input --
  // e.g. a rapid double Enter/click in the same tick. State updates alone
  // can't guarantee that render has happened yet; this ref can.
  const sendGuardRef = useRef<Set<string>>(new Set());
  // A model the user picked while a conversation was already in progress --
  // held here until they confirm, rather than switched immediately, so an
  // in-progress chat is never silently reattributed to a different model.
  const [pendingModel, setPendingModel] = useState<string | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const selectedModel = activeConversation?.model ?? draftModel;
  const messages = activeConversation?.messages ?? [];
  const isTyping = activeConversationId !== null && pendingConversationIds.has(activeConversationId);

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

  // The only place that actually talks to the backend. `history` is
  // whatever should be sent as context AND is the exact array the
  // resulting assistant/error message gets appended onto -- callers
  // (send and retry) are responsible for making sure it ends with the
  // one user message this request is answering, so a retry that reuses
  // this with the same history can never duplicate that user message.
  // Always writes into `conversationId` specifically (never "whichever
  // conversation is active when this resolves"), so switching
  // conversations or models while this is in flight can't misattribute
  // the eventual response -- if conversationId was since deleted,
  // appendToConversation's map simply matches nothing and this becomes a
  // harmless no-op.
  const requestAssistantReply = async (conversationId: string, model: string, history: Message[]) => {
    setPendingConversationIds((prev) => new Set(prev).add(conversationId));

    // Only reassigned once we've actually classified a response from our
    // own backend -- any other failure (network error, timeout, unreadable
    // JSON, etc.) leaves this at the safe, generic default.
    let userFacingMessage = "Something went wrong reaching the model. Please try again.";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
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
        userFacingMessage = describeFailure(errorBody?.error?.code, model, errorBody?.error?.resetAt);
        throw new Error("Chat request failed");
      }

      const data = (await response.json()) as ChatApiResponse;

      // The backend already rejects an empty/unparseable model reply as
      // its own classified failure before this ever gets a 200 -- this is
      // just the last line of defense against a genuinely malformed
      // response shape, so a missing/blank message.content still can't
      // slip through as a fabricated empty assistant bubble.
      if (!data.message || typeof data.message.content !== "string" || !data.message.content.trim()) {
        console.error("Chat response had an unexpected shape:", data);
        throw new Error("Malformed chat response");
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message.content,
        model: data.message.model,
        createdAt: new Date().toISOString(),
      };
      appendToConversation(conversationId, [...history, assistantMessage]);
    } catch (error) {
      console.error("Failed to get a response:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: userFacingMessage,
        model,
        createdAt: new Date().toISOString(),
        isError: true,
      };
      appendToConversation(conversationId, [...history, errorMessage]);
    } finally {
      setPendingConversationIds((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
    }
  };

  const handleSendMessage = (content: string) => {
    if (!selectedModel) return;

    // Guards against a second send landing before React has re-rendered
    // the disabled input -- a plain state check can't catch a same-tick
    // double Enter/click since the state update that would disable the
    // UI hasn't been applied yet. Keyed on the conversation about to
    // receive this message (or a shared sentinel while still a draft,
    // since a draft has no id of its own until the request below starts).
    const guardKey = activeConversationId ?? "__draft__";
    if (sendGuardRef.current.has(guardKey)) return;
    sendGuardRef.current.add(guardKey);

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
        title: generateTitle(content),
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

  // Replaces a failed request's error bubble in place rather than
  // appending alongside it -- `history` here is everything up to and
  // including the original user message (the error bubble itself is
  // excluded), so the retried request's result lands right where the
  // error was, and the triggering user message is never duplicated.
  const handleRetryMessage = (errorMessageId: string) => {
    if (!activeConversation || !selectedModel) return;
    if (sendGuardRef.current.has(activeConversation.id)) return;

    const errorIndex = activeConversation.messages.findIndex((m) => m.id === errorMessageId);
    if (errorIndex <= 0) return;
    const triggerMessage = activeConversation.messages[errorIndex - 1];
    if (triggerMessage.role !== "user") return;

    const history = activeConversation.messages.slice(0, errorIndex);
    appendToConversation(activeConversation.id, history);

    const conversationId = activeConversation.id;
    sendGuardRef.current.add(conversationId);
    void requestAssistantReply(conversationId, selectedModel, history).finally(() => {
      sendGuardRef.current.delete(conversationId);
    });
  };

  // Leaves the current conversation (already persisted, since it can only
  // become active with at least one message in it) untouched in the list
  // and returns to a fresh draft on the same model. A no-op if already on
  // an empty draft, so repeated clicks can't create empty duplicates.
  const handleNewChat = () => {
    if (activeConversationId === null) return;
    setDraftModel(activeConversation?.model ?? null);
    setActiveConversationId(null);
  };

  // isTyping is derived from pendingConversationIds, so switching here
  // automatically shows/hides loading correctly for wherever we land --
  // no manual reset needed, and (unlike a manual reset) it can't hide a
  // genuinely still-running request if the user switches back.
  const handleSelectConversation = (conversationId: string) => {
    if (conversationId === activeConversationId) return;
    setPendingModel(null);
    setDraftModel(null);
    setActiveConversationId(conversationId);
  };

  // A pure metadata edit -- doesn't touch updatedAt, so renaming a
  // conversation never reorders the sidebar (matching how it behaves in
  // most chat apps: only actual conversation activity moves it). Empty or
  // whitespace-only titles are rejected rather than silently accepted.
  const handleRenameConversation = (conversationId: string, newTitle: string) => {
    const cleaned = newTitle.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, title: cleaned } : c)));
  };

  const handleDeleteConversation = (conversationId: string) => {
    const remaining = conversations.filter((c) => c.id !== conversationId);
    setConversations(remaining);

    if (conversationId !== activeConversationId) return;

    // Deleted the active conversation -- land on the next most recently
    // updated survivor, or the true Welcome screen if none are left.
    const nextActive = remaining.reduce<Conversation | null>(
      (latest, c) => (!latest || c.updatedAt > latest.updatedAt ? c : latest),
      null,
    );
    setActiveConversationId(nextActive?.id ?? null);
    setDraftModel(null);
    setPendingModel(null);
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
        onRetryMessage={handleRetryMessage}
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
