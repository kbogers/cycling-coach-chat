import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChatClient } from "@/components/chat-client";
import { getSession } from "@/lib/session";
import { getUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await getSession();
  if (!session.athleteId || !getUser(session.athleteId)) {
    redirect("/onboarding");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ChatClient />
    </Suspense>
  );
}
