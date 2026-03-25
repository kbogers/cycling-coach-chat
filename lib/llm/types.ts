export type ChatMessage = { role: "user" | "assistant"; content: string };

export type StreamChatParams = {
  model?: string;
  systemPrompt: string;
  messages: ChatMessage[];
  apiKey: string;
};

export type LLMProvider = {
  streamChat(params: StreamChatParams): Promise<ReadableStream<Uint8Array>>;
};
