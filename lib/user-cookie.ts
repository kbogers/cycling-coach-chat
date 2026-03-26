import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import type { StoredUser } from "@/lib/store";
import { getSessionSealPassword } from "@/lib/session";

const COOKIE_PREFIX = "acc_user";
const MAX_CHUNKS = 5;
const CHUNK_SIZE = 3800;
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

const cookieOpts = () =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE_SEC,
    path: "/",
  });

function chunkName(i: number) {
  return `${COOKIE_PREFIX}.${i}`;
}

export async function saveUserCookie(data: StoredUser): Promise<void> {
  const sealed = await sealData(data, {
    password: getSessionSealPassword(),
    ttl: MAX_AGE_SEC,
  });
  const opts = cookieOpts();
  const cookieStore = await cookies();
  const chunks = Math.ceil(sealed.length / CHUNK_SIZE);
  for (let i = 0; i < chunks; i++) {
    cookieStore.set(
      chunkName(i),
      sealed.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      opts,
    );
  }
  for (let i = chunks; i < MAX_CHUNKS; i++) {
    cookieStore.delete(chunkName(i));
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
      ttl: MAX_AGE_SEC,
    });
  } catch {
    return null;
  }
}

export async function deleteUserCookie(): Promise<void> {
  const cookieStore = await cookies();
  for (let i = 0; i < MAX_CHUNKS; i++) {
    cookieStore.delete(chunkName(i));
  }
}
