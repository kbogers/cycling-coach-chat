"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";
import { Loader2, Send, Settings } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  clearChatMessages,
  loadChatMessages,
  saveChatMessages,
  type ChatMessage,
} from "@/lib/onboarding-storage";
import type { UserProfile } from "@/lib/types";

type Me = {
  athlete: { firstname: string; lastname: string; profile?: string };
  profile: UserProfile;
};

export function ChatClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsProfile, setSettingsProfile] = useState<UserProfile | null>(
    null
  );
  const [newGeminiKey, setNewGeminiKey] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setMessages(loadChatMessages());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveChatMessages(messages);
  }, [messages, hydrated]);

  const messageCountRef = useRef(0);
  useEffect(() => {
    messageCountRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    const onUnload = () => {
      track("chat_session", { message_count: messageCountRef.current });
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/session/me");
    if (!res.ok) {
      router.replace("/onboarding");
      return;
    }
    const data = (await res.json()) as Me & { authenticated?: boolean };
    if (!data.authenticated) {
      router.replace("/onboarding");
      return;
    }
    setMe({ athlete: data.athlete, profile: data.profile });
    setSettingsProfile(data.profile);
  }, [router]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      track("onboarding_completed");
      router.replace("/chat", { scroll: false });
    }
  }, [searchParams, router]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    track("chat_message_sent", { message_index: nextMessages.length });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          typeof err === "object" && err && "error" in err
            ? String((err as { error: string }).error)
            : "Request failed";
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `**Error:** ${msg}` },
        ]);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }
      const decoder = new TextDecoder();
      let assistant = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            last.content = assistant;
          }
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          last.content = `**Error:** ${e instanceof Error ? e.message : "Unknown"}`;
          return copy;
        }
        return [
          ...copy,
          {
            role: "assistant",
            content: `**Error:** ${e instanceof Error ? e.message : "Unknown"}`,
          },
        ];
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const saveSettings = useCallback(async () => {
    if (!settingsProfile) return;
    setSavingSettings(true);
    try {
      const body: Record<string, unknown> = {
        ...settingsProfile,
      };
      if (newGeminiKey.trim()) {
        body.geminiApiKey = newGeminiKey.trim();
      }
      const res = await fetch("/api/session/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err === "object" && err && "error" in err
            ? String((err as { error: string }).error)
            : "Save failed"
        );
      }
      setNewGeminiKey("");
      await loadMe();
      setSettingsOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSettings(false);
    }
  }, [settingsProfile, newGeminiKey, loadMe]);

  const reconnectStrava = useCallback(async () => {
    track("strava_reconnected");
    const res = await fetch("/api/auth/strava/prepare", { method: "POST" });
    if (!res.ok) {
      alert("Could not start Strava reconnect.");
      return;
    }
    const data = (await res.json()) as { pendingId?: string };
    if (!data.pendingId) {
      alert("Invalid server response.");
      return;
    }
    window.location.href = `/api/auth/strava?pendingId=${encodeURIComponent(data.pendingId)}`;
  }, []);

  const disconnectStrava = useCallback(async () => {
    if (!confirm("Disconnect Strava and sign out? Your local chat history will be cleared from this device.")) {
      return;
    }
    await fetch("/api/session/disconnect", { method: "POST" });
    clearChatMessages();
    router.replace("/onboarding");
  }, [router]);

  const clearHistory = useCallback(() => {
    if (!confirm("Clear all messages in this browser?")) return;
    clearChatMessages();
    setMessages([]);
  }, []);

  if (!me || !settingsProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = `${me.athlete.firstname[0] ?? ""}${me.athlete.lastname[0] ?? ""}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {me.athlete.profile ? (
              <AvatarImage src={me.athlete.profile} alt="" />
            ) : null}
            <AvatarFallback className="font-mono text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold leading-tight">AI Cycling Coach</p>
            <p className="text-muted-foreground text-xs">
              {me.athlete.firstname} {me.athlete.lastname}
            </p>
          </div>
        </div>
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              onClick={() => {
                track("settings_opened");
                setSettingsProfile(me.profile);
              }}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
              <SheetDescription>
                Update your profile or API key. Strava tokens stay on the server.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="s-goal">Goal</Label>
                <Input
                  id="s-goal"
                  value={settingsProfile.goal}
                  maxLength={280}
                  onChange={(e) =>
                    setSettingsProfile((p) =>
                      p ? { ...p, goal: e.target.value } : p
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-notes">Notes for your coach</Label>
                <Textarea
                  id="s-notes"
                  rows={3}
                  maxLength={2000}
                  placeholder="Injuries, schedule limits, preferences…"
                  value={settingsProfile.notes ?? ""}
                  onChange={(e) =>
                    setSettingsProfile((p) =>
                      p ? { ...p, notes: e.target.value } : p
                    )
                  }
                />
                <p className="text-muted-foreground text-xs">
                  {(settingsProfile.notes ?? "").length}/2000
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Days / week</Label>
                  <Input
                    type="number"
                    min={1}
                    max={7}
                    value={settingsProfile.trainingDaysPerWeek}
                    onChange={(e) =>
                      setSettingsProfile((p) =>
                        p
                          ? {
                              ...p,
                              trainingDaysPerWeek: Number(e.target.value),
                            }
                          : p
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>DOB</Label>
                  <Input
                    type="date"
                    value={settingsProfile.dateOfBirth}
                    onChange={(e) =>
                      setSettingsProfile((p) =>
                        p ? { ...p, dateOfBirth: e.target.value } : p
                      )
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Weight</Label>
                  <Input
                    type="number"
                    value={settingsProfile.weight}
                    onChange={(e) =>
                      setSettingsProfile((p) =>
                        p ? { ...p, weight: Number(e.target.value) } : p
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-muted-foreground text-xs">kg</span>
                    <Switch
                      checked={settingsProfile.weightUnit === "lb"}
                      onCheckedChange={(c) =>
                        setSettingsProfile((p) =>
                          p ? { ...p, weightUnit: c ? "lb" : "kg" } : p
                        )
                      }
                    />
                    <span className="text-muted-foreground text-xs">lb</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label className="font-mono text-xs">Max HR</Label>
                  <Input
                    type="number"
                    value={settingsProfile.maxHr}
                    onChange={(e) =>
                      setSettingsProfile((p) =>
                        p ? { ...p, maxHr: Number(e.target.value) } : p
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs">LTHR</Label>
                  <Input
                    type="number"
                    value={settingsProfile.lthr}
                    onChange={(e) =>
                      setSettingsProfile((p) =>
                        p ? { ...p, lthr: Number(e.target.value) } : p
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs">FTP</Label>
                  <Input
                    type="number"
                    value={settingsProfile.ftp}
                    onChange={(e) =>
                      setSettingsProfile((p) =>
                        p ? { ...p, ftp: Number(e.target.value) } : p
                      )
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-gemini">New Gemini API key (optional)</Label>
                <Input
                  id="s-gemini"
                  type="password"
                  autoComplete="off"
                  value={newGeminiKey}
                  onChange={(e) => setNewGeminiKey(e.target.value)}
                  placeholder="Leave blank to keep current key"
                />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? "Saving…" : "Save changes"}
                </Button>
                <Button type="button" variant="outline" onClick={reconnectStrava}>
                  Reconnect Strava
                </Button>
                <Button variant="destructive" onClick={disconnectStrava}>
                  Disconnect Strava
                </Button>
                <Button variant="outline" onClick={clearHistory}>
                  Clear chat history
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Ask anything about your training, fatigue, or upcoming goals — answers
              use your Strava activities and the profile you set up.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card text-card-foreground"
                }`}
              >
                {m.role === "user" ? (
                  m.content
                ) : m.content === "" && loading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    …
                  </span>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-headings:font-semibold prose-headings:text-foreground prose-strong:text-foreground">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t bg-background p-4">
        <form
          className="mx-auto flex max-w-2xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach…"
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
