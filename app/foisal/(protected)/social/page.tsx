import { db } from "@/lib/db";
import { SocialManager } from "@/components/admin/social-manager";
import type { SocialLink } from "@/lib/types";

export const dynamic = "force-dynamic";

/** /foisal/social — header / footer / contact icons. */
export default async function AdminSocialPage() {
  const { data } = await db()
    .from("social_links")
    .select("*")
    .order("sort_order", { ascending: true });

  return <SocialManager initial={(data ?? []) as SocialLink[]} />;
}
