import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FamilySetup } from "@/components/family-setup";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sua família" };
export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (user.familyId) redirect("/");

  return <FamilySetup firstName={user.name.split(/\s+/)[0]} />;
}
