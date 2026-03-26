import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getSession } from "@/lib/session";
import { getUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (session.athleteId && (await getUser(session.athleteId))) {
    redirect("/chat");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <OnboardingWizard />
    </Suspense>
  );
}
