import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session.athleteId && (await getUser(session.athleteId))) {
    redirect("/chat");
  }
  redirect("/onboarding");
}
