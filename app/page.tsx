import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserFromCookie } from "@/lib/user-cookie";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session.athleteId && (await getUserFromCookie())) {
    redirect("/chat");
  }
  redirect("/onboarding");
}
