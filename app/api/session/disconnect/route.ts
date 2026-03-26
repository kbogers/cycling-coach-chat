import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/session";
import { deleteUser } from "@/lib/store";
import { deleteUserCookieOnResponse } from "@/lib/user-cookie";

export async function POST() {
  const session = await getSession();
  const id = session.athleteId;
  if (id) {
    deleteUser(id);
  }
  await clearSession();
  const res = NextResponse.json({ ok: true });
  deleteUserCookieOnResponse(res);
  return res;
}
