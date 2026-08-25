// Reads and writes the conversation history to localStorage, validating saved data.
import type { Conversation, Message } from "../types/chat";

// Namespaced and versioned so it never collides with anything else that
// might use localStorage, and so a future breaking change to the shape
// can ship under a new key instead of trying to migrate the old one.
const STORAGE_KEY = "ai-model-switcher:conversations:v1";

export type PersistedState = {
  conversations: Conversation[];
  activeConversationId: string | null;
};

const EMPTY_STATE: PersistedState = { conversations: [], activeConversationId: null };

function isMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    typeof message.createdAt === "string"
  );
}

function isConversation(value: unknown): value is Conversation {
  if (typeof value !== "object" || value === null) return false;
  const conversation = value as Record<string, unknown>;
  return (
    typeof conversation.id === "string" &&
    typeof conversation.title === "string" &&
    typeof conversation.model === "string" &&
    typeof conversation.createdAt === "string" &&
    typeof conversation.updatedAt === "string" &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every(isMessage)
  );
}

// Reads and validates whatever is in localStorage. Never throws -- a
// missing key, invalid JSON, or a malformed shape all fall back to a
// valid empty state instead of surfacing a raw parsing error to the user
// or crashing the app. A single malformed conversation is dropped rather
// than discarding everything else that parsed fine.
export function loadState(): PersistedState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error("[storage] localStorage is unavailable:", error);
    return EMPTY_STATE;
  }
  if (!raw) return EMPTY_STATE;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("[storage] saved conversation data is not valid JSON:", error);
    return EMPTY_STATE;
  }

  if (typeof parsed !== "object" || parsed === null) {
    console.error("[storage] saved conversation data has an unexpected shape:", parsed);
    return EMPTY_STATE;
  }

  const state = parsed as Record<string, unknown>;
  const rawConversations = Array.isArray(state.conversations) ? state.conversations : [];
  const conversations = rawConversations.filter(isConversation);
  if (conversations.length !== rawConversations.length) {
    console.error("[storage] dropped one or more malformed conversation entries while restoring saved data");
  }

  const activeConversationId = typeof state.activeConversationId === "string" ? state.activeConversationId : null;

  return { conversations, activeConversationId };
}

// Persists the full conversation set. Called from a single effect keyed
// on conversations/activeConversationId, not on every render.
export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("[storage] failed to save conversations:", error);
  }
}
