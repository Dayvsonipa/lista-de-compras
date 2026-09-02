import { redirect } from "next/navigation";
import { ShoppingApp } from "@/components/shopping-app";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (!user.familyId || !user.familyName) redirect("/familia");

  return (
    <ShoppingApp
      userName={user.name}
      familyName={user.familyName}
      inviteCode={user.inviteCode}
    />
  );
}
