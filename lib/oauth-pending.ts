import { sealData, unsealData } from "iron-session";
import type { UserProfile } from "@/lib/types";
import { getSessionSealPassword } from "@/lib/session";

/** HttpOnly cookie holding sealed onboarding payload (survives Vercel multi-instance). */
export const OAUTH_PENDING_COOKIE_NAME = "acc_coach_oauth_pending";

export const OAUTH_PENDING_MAX_AGE_SEC = 60 * 15;

export type OAuthPendingCookiePayload = {
  stateId: string;
  profile: UserProfile;
  geminiKeyEncrypted: string;
};

export async function sealOAuthPendingPayload(
  payload: OAuthPendingCookiePayload
): Promise<string> {
  return sealData(payload, {
    password: getSessionSealPassword(),
    ttl: OAUTH_PENDING_MAX_AGE_SEC,
  });
}

export async function unsealOAuthPendingPayload(
  seal: string
): Promise<OAuthPendingCookiePayload> {
  return unsealData<OAuthPendingCookiePayload>(seal, {
    password: getSessionSealPassword(),
    ttl: OAUTH_PENDING_MAX_AGE_SEC,
  });
}
