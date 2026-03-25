import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { getLLMProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm/types";
import { buildSystemPrompt } from "@/lib/prompt";
import { getSession } from "@/lib/session";
import {
  buildStravaContextBlock,
  fetchRecentActivities,
  getValidStravaTokens,
  type StravaActivity,
} from "@/lib/strava";
import { getCachedPayload, setCachedPayload, setUser, getUser } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE = new Map<number, { n: number; reset: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

function checkRate(athleteId: number): boolean {
  const now = Date.now();
  const row = RATE.get(athleteId);
  if (!row || now > row.reset) {
    RATE.set(athleteId, { n: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (row.n >= RATE_MAX) return false;
  row.n += 1;
  return true;
}

export async function POST(request: Request) {
  const enc = process.env.ENCRYPTION_KEY;
  if (!enc || enc.length < 32) {
    return NextResponse.json(
      { error: "Encryption not configured" },
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

  if (!checkRate(athleteId)) {
    return NextResponse.json(
      { error: "Too many requests. Wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  const last = messages[messages.length - 1];
  if (last.role !== "user" || typeof last.content !== "string") {
    return NextResponse.json(
      { error: "Last message must be a user message" },
      { status: 400 }
    );
  }

  const freshTokens = await getValidStravaTokens(user.strava);
  if (
    freshTokens.accessToken !== user.strava.accessToken ||
    freshTokens.expiresAt !== user.strava.expiresAt
  ) {
    setUser(athleteId, { ...user, strava: freshTokens });
  }

  const cacheKey = `strava-activities:${athleteId}`;
  const cached = getCachedPayload(cacheKey);
  let activities: StravaActivity[];
  if (cached) {
    try {
      activities = JSON.parse(cached) as StravaActivity[];
    } catch {
      activities = await fetchRecentActivities(freshTokens.accessToken);
      setCachedPayload(cacheKey, JSON.stringify(activities));
    }
  } else {
    activities = await fetchRecentActivities(freshTokens.accessToken);
    setCachedPayload(cacheKey, JSON.stringify(activities));
  }

  const stravaContext = buildStravaContextBlock(activities, last.content);
  const systemPrompt = buildSystemPrompt(user.profile, stravaContext);

  let apiKey: string;
  try {
    apiKey = decryptSecret(user.geminiKeyEncrypted, enc);
  } catch {
    return NextResponse.json(
      { error: "Could not decrypt API key. Update it in Settings." },
      { status: 500 }
    );
  }

  const provider = getLLMProvider();
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await provider.streamChat({
      systemPrompt,
      messages,
      apiKey,
    });
  } catch (e) {
    let message = e instanceof Error ? e.message : "LLM error";
    if (e instanceof Error && e.cause) {
      const causeMsg = e.cause instanceof Error ? e.cause.message : String(e.cause);
      message += ` (cause: ${causeMsg})`;
    }
    console.error("[chat] LLM error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
