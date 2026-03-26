import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/session";
import { deleteUser } from "@/lib/store";
import { deleteUserCookie } from "@/lib/user-cookie";

export async function POST() {
  const session = await getSession();
  const id = session.athleteId;
  if (id) {
    deleteUser(id);
  }
  await deleteUserCookie();
  await clearSession();
  return NextResponse.json({ ok: true });
}
