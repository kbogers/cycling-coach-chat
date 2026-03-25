import type { LLMProvider } from "@/lib/llm/types";
import { geminiProvider } from "@/lib/llm/gemini";

export function getLLMProvider(): LLMProvider {
  return geminiProvider;
}

export type { ChatMessage, LLMProvider, StreamChatParams } from "@/lib/llm/types";
