import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUser, savePendingOnboarding } from "@/lib/store";

/** Creates a pending OAuth state from the logged-in user (reconnect Strava). */
export async function POST() {
  const session = await getSession();
  const athleteId = session.athleteId;
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getUser(athleteId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stateId = randomUUID();
  await savePendingOnboarding(stateId, {
    profile: user.profile,
    geminiKeyEncrypted: user.geminiKeyEncrypted,
  });
  return NextResponse.json({ pendingId: stateId });
}
