import type { StravaTokens, UserProfile } from "@/lib/types";

export type StoredUser = {
  profile: UserProfile;
  geminiKeyEncrypted: string;
  strava: StravaTokens;
  athlete: { id: number; firstname: string; lastname: string; profile?: string };
};

const CACHE_TTL_MS = 1000 * 60 * 5;

const g = globalThis as unknown as {
  __userStore?: Map<number, StoredUser>;
  __stravaCache?: Map<string, { at: number; payload: string }>;
};

function users(): Map<number, StoredUser> {
  if (!g.__userStore) g.__userStore = new Map();
  return g.__userStore;
}

function stravaCache(): Map<string, { at: number; payload: string }> {
  if (!g.__stravaCache) g.__stravaCache = new Map();
  return g.__stravaCache;
}

export function setUser(athleteId: number, data: StoredUser): void {
  users().set(athleteId, data);
}

export function getUser(athleteId: number): StoredUser | undefined {
  return users().get(athleteId);
}

export function deleteUser(athleteId: number): void {
  users().delete(athleteId);
}

export function getCachedPayload(key: string): string | null {
  const row = stravaCache().get(key);
  if (!row || Date.now() - row.at > CACHE_TTL_MS) {
    stravaCache().delete(key);
    return null;
  }
  return row.payload;
}

export function setCachedPayload(key: string, payload: string): void {
  stravaCache().set(key, { at: Date.now(), payload });
}
