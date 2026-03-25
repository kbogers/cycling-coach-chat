import type { LLMProvider, StreamChatParams } from "@/lib/llm/types";

const DEFAULT_MODEL = "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export const geminiProvider: LLMProvider = {
  async streamChat(params: StreamChatParams) {
    const model = params.model ?? DEFAULT_MODEL;
    const url = `${BASE_URL}/models/${model}:streamGenerateContent?alt=sse&key=${params.apiKey}`;

    const contents = params.messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const body = JSON.stringify({
      system_instruction: { parts: [{ text: params.systemPrompt }] },
      contents,
    });

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (e: unknown) {
      const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : "";
      throw new Error(
        `Network error calling Gemini API: ${e instanceof Error ? e.message : e}${cause ? ` (cause: ${cause})` : ""}`
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Gemini API ${res.status}: ${detail || res.statusText}`
      );
    }

    const encoder = new TextEncoder();
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    return new ReadableStream({
      async start(controller) {
        try {
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });

            const lines = buf.split("\n");
            buf = lines.pop()!;

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6);
              if (json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) controller.enqueue(encoder.encode(text));
              } catch {
                // skip unparseable SSE chunks
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });
  },
};
