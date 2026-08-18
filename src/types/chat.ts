export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};