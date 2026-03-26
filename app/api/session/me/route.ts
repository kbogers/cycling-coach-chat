import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserFromCookie } from "@/lib/user-cookie";

export async function GET() {
  const session = await getSession();
  const athleteId = session.athleteId;
  if (!athleteId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const profile = user.profile;
  return NextResponse.json({
    authenticated: true,
    athlete: user.athlete,
    profile: {
      ...profile,
      notes: profile.notes ?? "",
    },
  });
}
