// Shared frontend types for chat messages and persisted conversations.
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  createdAt: string;
  // A local failure notice, excluded from context sent to the model.
  isError?: boolean;
  // True while a reply is still streaming in.
  isStreaming?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  // True once the title is locked and won't be auto-generated again.
  titleFinal?: boolean;
};