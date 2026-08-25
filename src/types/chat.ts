// Shared frontend types for chat messages and persisted conversations.
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  createdAt: string;
  // A locally-generated failure notice (e.g. "Something went wrong reaching
  // the model"), not a real reply from the model. Displayed identically to
  // any other assistant bubble, but excluded when building the message
  // history sent back to the model on the next turn -- otherwise it would
  // look like the model actually said that.
  isError?: boolean;
  // True only while a streaming response is still actively receiving
  // content -- cleared once the stream completes. Purely a rendering hint
  // (suppresses the separate "waiting for a reply" indicator once real
  // content is visible, and gates the Regenerate/Copy actions); never
  // meaningful to rely on after a page reload, since in-flight requests
  // aren't restored.
  isStreaming?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  // True once the title should never be auto-changed again -- set either
  // by a successful (or exhausted) automatic title-generation pass after
  // the first exchange, or immediately by a manual rename. Conversations
  // restored from before this field existed simply come back as
  // undefined/falsy, which correctly means "still eligible for automatic
  // title generation."
  titleFinal?: boolean;
};