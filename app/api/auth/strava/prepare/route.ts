import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  OAUTH_PENDING_COOKIE_NAME,
  OAUTH_PENDING_MAX_AGE_SEC,
  sealOAuthPendingPayload,
} from "@/lib/oauth-pending";
import { getSession } from "@/lib/session";
import { getUserFromCookie } from "@/lib/user-cookie";

/** Creates a pending OAuth state from the logged-in user (reconnect Strava). */
export async function POST() {
  const session = await getSession();
  const athleteId = session.athleteId;
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stateId = randomUUID();
  const seal = await sealOAuthPendingPayload({
    stateId,
    profile: user.profile,
    geminiKeyEncrypted: user.geminiKeyEncrypted,
  });
  const res = NextResponse.json({ pendingId: stateId });
  res.cookies.set(OAUTH_PENDING_COOKIE_NAME, seal, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: OAUTH_PENDING_MAX_AGE_SEC,
    path: "/",
  });
  return res;
}
