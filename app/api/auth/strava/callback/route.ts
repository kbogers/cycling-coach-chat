import { NextResponse } from "next/server";
import { fetchAthlete, getStravaRedirectUri } from "@/lib/strava";
import { saveSessionToResponse } from "@/lib/session";
import { setUser, takePendingOnboarding } from "@/lib/store";
import type { StravaTokens } from "@/lib/types";

function isTlsOrCertFetchError(e: unknown): boolean {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let i = 0; i < 6 && cur; i++) {
    if (cur instanceof Error) {
      parts.push(cur.message);
      const code = (cur as NodeJS.ErrnoException).code;
      if (typeof code === "string") parts.push(code);
      cur = cur.cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  const s = parts.join(" ");
  return /SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_VERIFY_LEAF_SIGNATURE|certificate|SSL|TLS/i.test(
    s,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const err = searchParams.get("error");

  const base = new URL(request.url).origin;

  if (err) {
    return NextResponse.redirect(
      `${base}/onboarding?error=${encodeURIComponent(err)}`,
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      `${base}/onboarding?error=${encodeURIComponent("missing_code_or_state")}`,
    );
  }

  const pending = await takePendingOnboarding(state);
  if (!pending) {
    console.error("[strava/callback] no pending record for state", state);
    return NextResponse.redirect(
      `${base}/onboarding?error=${encodeURIComponent("session_expired_retry")}`,
    );
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = getStravaRedirectUri(request);
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${base}/onboarding?error=${encodeURIComponent("server_config")}`,
    );
  }

  try {
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(
        `${base}/onboarding?error=${encodeURIComponent("strava_token_exchange")}`,
      );
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };

    const strava: StravaTokens = {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      expiresAt: tokenJson.expires_at * 1000,
    };

    const athlete = await fetchAthlete(strava.accessToken);

    await setUser(athlete.id, {
      profile: pending.profile,
      geminiKeyEncrypted: pending.geminiKeyEncrypted,
      strava,
      athlete: {
        id: athlete.id,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
        profile: athlete.profile,
      },
    });

    const ok = NextResponse.redirect(`${base}/chat?welcome=1`);
    await saveSessionToResponse({ athleteId: athlete.id }, ok);
    return ok;
  } catch (e) {
    console.error("[strava/callback]", e);
    if (isTlsOrCertFetchError(e)) {
      return NextResponse.redirect(
        `${base}/onboarding?error=${encodeURIComponent("strava_tls")}`,
      );
    }
    return NextResponse.redirect(
      `${base}/onboarding?error=${encodeURIComponent("strava_callback_failed")}`,
    );
  }
}
