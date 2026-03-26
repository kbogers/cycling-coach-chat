import { getIronSession, sealData, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

/** Shape stored in the iron-session cookie (iron-session v8 requires an explicit generic on getIronSession). */
export type SessionData = {
  athleteId?: number;
};

const DEV_SESSION_PASSWORD = "dev-insecure-min-32-chars-long-secret!!";

/** iron-session requires ≥32 chars; a short SESSION_SECRET throws and surfaces as HTTP 500 on save. */
function sessionPassword(): string {
  const raw = process.env.SESSION_SECRET;
  if (raw && raw.length >= 32) return raw;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters (iron-session requirement)."
    );
  }
  if (raw !== undefined) {
    console.warn(
      "[session] SESSION_SECRET is too short; using dev-only fallback. Set a 32+ character secret in .env.local."
    );
  }
  return DEV_SESSION_PASSWORD;
}

let sessionOptionsCache: SessionOptions | undefined;

function getSessionOptions(): SessionOptions {
  if (!sessionOptionsCache) {
    sessionOptionsCache = {
      password: sessionPassword(),
      cookieName: "acc_coach_session",
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      },
    };
  }
  return sessionOptionsCache;
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function saveSession(data: { athleteId?: number }): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions());
  if (data.athleteId !== undefined) session.athleteId = data.athleteId;
  await session.save();
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions());
  session.destroy();
}

/** Set iron-session cookie directly on a NextResponse (avoids cookies() merge issues). */
export async function saveSessionToResponse(
  data: { athleteId?: number },
  response: NextResponse,
): Promise<void> {
  const opts = getSessionOptions();
  const sealed = await sealData(data, {
    password: opts.password as string,
    ttl: opts.cookieOptions?.maxAge ?? 0,
  });
  response.cookies.set(opts.cookieName, sealed, {
    httpOnly: opts.cookieOptions?.httpOnly,
    secure: opts.cookieOptions?.secure,
    sameSite: opts.cookieOptions?.sameSite as "lax",
    maxAge: opts.cookieOptions?.maxAge,
    path: opts.cookieOptions?.path,
  });
}
