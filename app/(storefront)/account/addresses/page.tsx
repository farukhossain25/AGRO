import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { AddressManager } from "@/components/address-manager";
import type { Address } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = await currentUser();
  if (!user) return null;

  const { data } = await db()
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  return <AddressManager initial={(data ?? []) as Address[]} />;
}
