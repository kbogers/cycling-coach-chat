import { getRedis } from "@/lib/kv";
import type { StravaTokens, UserProfile } from "@/lib/types";

export type StoredUser = {
  profile: UserProfile;
  geminiKeyEncrypted: string;
  strava: StravaTokens;
  athlete: { id: number; firstname: string; lastname: string; profile?: string };
};

export type PendingOnboarding = {
  profile: UserProfile;
  geminiKeyEncrypted: string;
};

const USER_KEY = (id: number) => `user:${id}`;
const PENDING_KEY = (stateId: string) => `pending:${stateId}`;
const CACHE_KEY = (key: string) => `cache:${key}`;

const USER_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const PENDING_TTL_SEC = 60 * 15; // 15 minutes
const CACHE_TTL_SEC = 60 * 5; // 5 minutes

// ── User records ────────────────────────────────────────────────────

export async function setUser(
  athleteId: number,
  data: StoredUser,
): Promise<void> {
  await getRedis().set(USER_KEY(athleteId), data, { ex: USER_TTL_SEC });
}

export async function getUser(
  athleteId: number,
): Promise<StoredUser | null> {
  return getRedis().get<StoredUser>(USER_KEY(athleteId));
}

export async function deleteUser(athleteId: number): Promise<void> {
  await getRedis().del(USER_KEY(athleteId));
}

// ── Pending onboarding (OAuth state) ────────────────────────────────

export async function savePendingOnboarding(
  stateId: string,
  data: PendingOnboarding,
): Promise<void> {
  await getRedis().set(PENDING_KEY(stateId), data, { ex: PENDING_TTL_SEC });
}

/** Retrieve and delete in one go (single-use). */
export async function takePendingOnboarding(
  stateId: string,
): Promise<PendingOnboarding | null> {
  const kv = getRedis();
  const key = PENDING_KEY(stateId);
  const data = await kv.get<PendingOnboarding>(key);
  if (data) await kv.del(key);
  return data;
}

// ── Strava activity cache ───────────────────────────────────────────

export async function getCachedPayload(
  key: string,
): Promise<string | null> {
  return getRedis().get<string>(CACHE_KEY(key));
}

export async function setCachedPayload(
  key: string,
  payload: string,
): Promise<void> {
  await getRedis().set(CACHE_KEY(key), payload, { ex: CACHE_TTL_SEC });
}
