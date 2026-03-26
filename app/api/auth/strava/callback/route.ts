import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchAthlete, getStravaRedirectUri } from "@/lib/strava";
import {
  OAUTH_PENDING_COOKIE_NAME,
  unsealOAuthPendingPayload,
} from "@/lib/oauth-pending";
import { saveSessionToResponse } from "@/lib/session";
import { setUser } from "@/lib/store";
import { setUserCookieOnResponse } from "@/lib/user-cookie";
import type { StravaTokens, UserProfile } from "@/lib/types";

/** Node fetch fails behind corporate TLS inspection (Zscaler, etc.) with this in the error chain. */
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
    s
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
      `${base}/onboarding?error=${encodeURIComponent(err)}`
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      `${base}/onboarding?error=${encodeURIComponent("missing_code_or_state")}`
    );
  }

  const cookieStore = await cookies();
  const seal = cookieStore.get(OAUTH_PENDING_COOKIE_NAME)?.value;
  let pending: {
    profile: UserProfile;
    geminiKeyEncrypted: string;
  } | null = null;

  if (!seal) {
    console.error("[strava/callback] pending cookie missing");
  } else if (state) {
    try {
      const data = await unsealOAuthPendingPayload(seal);
      if (data.stateId === state) {
        pending = {
          profile: data.profile,
          geminiKeyEncrypted: data.geminiKeyEncrypted,
        };
      } else {
        console.error("[strava/callback] state mismatch:", state, "vs", data.stateId);
      }
    } catch (e) {
      console.error("[strava/callback] unseal failed:", e);
    }
  }
  if (!pending) {
    const res = NextResponse.redirect(
      `${base}/onboarding?error=${encodeURIComponent("session_expired_retry")}`
    );
    res.cookies.delete(OAUTH_PENDING_COOKIE_NAME);
    return res;
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = getStravaRedirectUri(request);
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${base}/onboarding?error=${encodeURIComponent("server_config")}`
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
        `${base}/onboarding?error=${encodeURIComponent("strava_token_exchange")}`
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

    const userData = {
      profile: pending.profile,
      geminiKeyEncrypted: pending.geminiKeyEncrypted,
      strava,
      athlete: {
        id: athlete.id,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
        profile: athlete.profile,
      },
    };
    setUser(athlete.id, userData);

    const ok = NextResponse.redirect(`${base}/chat?welcome=1`);
    await setUserCookieOnResponse(userData, ok);
    await saveSessionToResponse({ athleteId: athlete.id }, ok);
    ok.cookies.delete(OAUTH_PENDING_COOKIE_NAME);
    return ok;
  } catch (e) {
    console.error("[strava/callback]", e);
    if (isTlsOrCertFetchError(e)) {
      return NextResponse.redirect(
        `${base}/onboarding?error=${encodeURIComponent("strava_tls")}`
      );
    }
    return NextResponse.redirect(
      `${base}/onboarding?error=${encodeURIComponent("strava_callback_failed")}`
    );
  }
}

