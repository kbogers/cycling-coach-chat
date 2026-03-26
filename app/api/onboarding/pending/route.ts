import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import {
  OAUTH_PENDING_COOKIE_NAME,
  OAUTH_PENDING_MAX_AGE_SEC,
  sealOAuthPendingPayload,
} from "@/lib/oauth-pending";
import { parseUserProfile } from "@/lib/validation";

export async function POST(request: Request) {
  const enc = process.env.ENCRYPTION_KEY;
  if (!enc || enc.length < 32) {
    return NextResponse.json(
      { error: "Server ENCRYPTION_KEY is not configured (min 32 chars)." },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const profile = parseUserProfile(body);
    const geminiApiKey =
      typeof body.geminiApiKey === "string" ? body.geminiApiKey.trim() : "";
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key is required." },
        { status: 400 }
      );
    }
    const geminiKeyEncrypted = encryptSecret(geminiApiKey, enc);
    const stateId = randomUUID();
    const seal = await sealOAuthPendingPayload({
      stateId,
      profile,
      geminiKeyEncrypted,
    });
    const cookieStore = await cookies();
    cookieStore.set(OAUTH_PENDING_COOKIE_NAME, seal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: OAUTH_PENDING_MAX_AGE_SEC,
      path: "/",
    });
    return NextResponse.json({ pendingId: stateId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
