import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getSession } from "@/lib/session";
import { getUserFromCookie } from "@/lib/user-cookie";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (session.athleteId && (await getUserFromCookie())) {
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
