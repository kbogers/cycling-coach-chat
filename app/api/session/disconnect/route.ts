import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/session";
import { deleteUser } from "@/lib/store";

export async function POST() {
  const session = await getSession();
  const id = session.athleteId;
  if (id) {
    await deleteUser(id);
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
