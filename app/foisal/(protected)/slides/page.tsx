import { db } from "@/lib/db";
import { SlideManager } from "@/components/admin/slide-manager";
import type { HeroSlide } from "@/lib/types";

export const dynamic = "force-dynamic";

/** /foisal/slides — the homepage carousel. */
export default async function AdminSlidesPage() {
  const { data } = await db()
    .from("hero_slides")
    .select("*")
    .order("sort_order", { ascending: true });

  return <SlideManager initial={(data ?? []) as HeroSlide[]} />;
}
