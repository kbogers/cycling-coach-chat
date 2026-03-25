import type { UserProfile } from "@/lib/types";

const KEY = "acc_onboarding_draft_v1";

export type OnboardingDraft = UserProfile & {
  geminiApiKey?: string;
  step: number;
};

export function loadDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: OnboardingDraft): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

const CHAT_KEY = "acc_chat_messages_v1";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function loadChatMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        m &&
        typeof m === "object" &&
        (m as ChatMessage).role !== undefined &&
        typeof (m as ChatMessage).content === "string"
    );
  } catch {
    return [];
  }
}

export function saveChatMessages(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
}

export function clearChatMessages(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CHAT_KEY);
}
