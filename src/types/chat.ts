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
};

export type Conversation = {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};