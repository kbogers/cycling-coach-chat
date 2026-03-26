import type { StravaTokens } from "@/lib/types";

const STRAVA_API = "https://www.strava.com/api/v3";

const STRAVA_CALLBACK_PATH = "/api/auth/strava/callback";

/**
 * OAuth redirect_uri must match the authorize request and token exchange exactly.
 * Prefer the current request origin so production (e.g. Vercel) works without a
 * separate env per host. Optional STRAVA_REDIRECT_URI overrides when set; if it
 * points at localhost but the incoming request is not localhost, ignore it so a
 * mis-copied .env on Vercel does not send users to localhost after Strava auth.
 */
export function getStravaRedirectUri(request: Request): string {
  const fromRequest = new URL(request.url).origin + STRAVA_CALLBACK_PATH;
  const explicit = process.env.STRAVA_REDIRECT_URI?.trim();
  if (!explicit) return fromRequest;
  try {
    const explicitHost = new URL(explicit).hostname;
    const reqHost = new URL(request.url).hostname;
    if (
      (explicitHost === "localhost" || explicitHost === "127.0.0.1") &&
      reqHost !== "localhost" &&
      reqHost !== "127.0.0.1"
    ) {
      return fromRequest;
    }
  } catch {
    return fromRequest;
  }
  return explicit;
}

export type StravaActivity = {
  id: number;
  name: string;
  type: string;
  start_date: string;
  elapsed_time: number;
  distance: number;
  total_elevation_gain: number;
  has_heartrate?: boolean;
  average_heartrate?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
};

export async function refreshStravaToken(
  refreshToken: string
): Promise<StravaTokens> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at * 1000,
  };
}

export async function getValidStravaTokens(
  tokens: StravaTokens
): Promise<StravaTokens> {
  const bufferMs = 60_000;
  if (Date.now() < tokens.expiresAt - bufferMs) {
    return tokens;
  }
  return refreshStravaToken(tokens.refreshToken);
}

async function stravaFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${STRAVA_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });
  if (res.status === 429) {
    throw new Error("Strava rate limit exceeded. Try again in a few minutes.");
  }
  if (!res.ok) {
    throw new Error(`Strava API error ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchAthlete(accessToken: string) {
  return stravaFetch<{
    id: number;
    firstname: string;
    lastname: string;
    profile?: string;
  }>("/athlete", accessToken);
}

export async function fetchRecentActivities(
  accessToken: string,
  perPage = 20
): Promise<StravaActivity[]> {
  return stravaFetch<StravaActivity[]>(
    `/athlete/activities?per_page=${perPage}`,
    accessToken
  );
}

/** Rough load score from kJ; not lab TSS but useful for context. */
function estimateTssFromActivity(a: StravaActivity): number | null {
  if (a.kilojoules && a.kilojoules > 0) {
    return Math.round(a.kilojoules * 0.85);
  }
  return null;
}

function formatActivityLine(a: StravaActivity): string {
  const date = a.start_date.slice(0, 10);
  const durMin = Math.round(a.elapsed_time / 60);
  const distKm = (a.distance / 1000).toFixed(1);
  const elev = Math.round(a.total_elevation_gain);
  const hr = a.average_heartrate
    ? `${Math.round(a.average_heartrate)} bpm avg HR`
    : "no HR";
  const watts = a.weighted_average_watts
    ? `${Math.round(a.weighted_average_watts)} W avg`
    : "no power";
  const tss = estimateTssFromActivity(a);
  const tssStr = tss != null ? `, est. load ~${tss} (from kJ)` : "";
  return `- ${date} "${a.name}" (${a.type}) — ${durMin} min, ${distKm} km, ${elev} m elev, ${hr}, ${watts}${tssStr}`;
}

export function buildStravaContextBlock(
  activities: StravaActivity[],
  userMessage: string
): string {
  const lines = activities.slice(0, 15).map(formatActivityLine);
  const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const recent = activities.filter(
    (a) => new Date(a.start_date).getTime() >= fourWeeksAgo
  );
  const rideTypes = new Set([
    "Ride",
    "VirtualRide",
    "EBikeRide",
    "GravelRide",
    "MountainBikeRide",
  ]);
  const rides = recent.filter((a) => rideTypes.has(a.type));
  const totalSeconds = rides.reduce((s, a) => s + a.elapsed_time, 0);
  const totalKm = rides.reduce((s, a) => s + a.distance, 0) / 1000;
  const summary = `Last 4 weeks (cycling-like activities): ${rides.length} rides, ${(totalSeconds / 3600).toFixed(1)} h moving time, ${totalKm.toFixed(0)} km total distance.`;

  let extra = "";
  const lower = userMessage.toLowerCase();
  for (const a of activities) {
    if (
      a.name.length > 3 &&
      lower.includes(a.name.toLowerCase().slice(0, Math.min(12, a.name.length)))
    ) {
      extra += `\nUser may be referring to: ${formatActivityLine(a)}\n`;
      break;
    }
  }

  return `${summary}

Recent activities (newest listed in detail up to 15):
${lines.join("\n")}
${extra}`;
}
