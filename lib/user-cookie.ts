import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { sealData, unsealData } from "iron-session";
import type { StoredUser } from "@/lib/store";
import { getSessionSealPassword } from "@/lib/session";

const COOKIE_PREFIX = "acc_user";
const MAX_CHUNKS = 5;
const CHUNK_SIZE = 3800;
export const USER_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

const cookieOpts = () =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: USER_COOKIE_MAX_AGE_SEC,
    path: "/",
  });

function chunkName(i: number) {
  return `${COOKIE_PREFIX}.${i}`;
}

async function sealUser(data: StoredUser): Promise<string> {
  return sealData(data, {
    password: getSessionSealPassword(),
    ttl: USER_COOKIE_MAX_AGE_SEC,
  });
}

/** Set user-cookie chunks directly on a NextResponse (safe for redirects). */
export async function setUserCookieOnResponse(
  data: StoredUser,
  response: NextResponse,
): Promise<void> {
  const sealed = await sealUser(data);
  const opts = cookieOpts();
  const chunks = Math.ceil(sealed.length / CHUNK_SIZE);
  for (let i = 0; i < chunks; i++) {
    response.cookies.set(
      chunkName(i),
      sealed.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      opts,
    );
  }
  for (let i = chunks; i < MAX_CHUNKS; i++) {
    response.cookies.delete(chunkName(i));
  }
}

/** Delete user-cookie chunks on a NextResponse. */
export function deleteUserCookieOnResponse(response: NextResponse): void {
  for (let i = 0; i < MAX_CHUNKS; i++) {
    response.cookies.delete(chunkName(i));
  }
}

export async function getUserFromCookie(): Promise<StoredUser | null> {
  const cookieStore = await cookies();
  let sealed = "";
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const chunk = cookieStore.get(chunkName(i))?.value;
    if (!chunk) break;
    sealed += chunk;
  }
  if (!sealed) return null;
  try {
    return await unsealData<StoredUser>(sealed, {
      password: getSessionSealPassword(),
      ttl: USER_COOKIE_MAX_AGE_SEC,
    });
  } catch {
    return null;
  }
}
