import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { getUser, setUser } from "@/lib/store";
import { parseUserProfile } from "@/lib/validation";

export async function PATCH(request: Request) {
  const enc = process.env.ENCRYPTION_KEY;
  if (!enc || enc.length < 32) {
    return NextResponse.json(
      { error: "Server ENCRYPTION_KEY is not configured." },
      { status: 500 }
    );
  }

  const session = await getSession();
  const athleteId = session.athleteId;
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = getUser(athleteId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const profile = parseUserProfile(body);
    let geminiKeyEncrypted = user.geminiKeyEncrypted;
    if (
      typeof body.geminiApiKey === "string" &&
      body.geminiApiKey.trim().length > 0
    ) {
      geminiKeyEncrypted = encryptSecret(body.geminiApiKey.trim(), enc);
    }
    setUser(athleteId, {
      ...user,
      profile,
      geminiKeyEncrypted,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
