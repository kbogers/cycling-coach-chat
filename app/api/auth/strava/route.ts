import { NextResponse } from "next/server";

const STRAVA_AUTH = "https://www.strava.com/oauth/authorize";

export async function GET(request: Request) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Strava OAuth is not configured." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const pendingId = searchParams.get("pendingId");
  if (!pendingId) {
    return NextResponse.json(
      { error: "Missing pendingId. Complete previous onboarding steps first." },
      { status: 400 }
    );
  }

  const u = new URL(STRAVA_AUTH);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("approval_prompt", "force");
  u.searchParams.set("scope", "activity:read_all");
  u.searchParams.set("state", pendingId);

  return NextResponse.redirect(u.toString());
}
