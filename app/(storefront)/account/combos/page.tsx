import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers, Plus } from "lucide-react";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { SavedCombos } from "@/components/saved-combos";

export const dynamic = "force-dynamic";

export const metadata = { title: "আমার কম্বো", robots: { index: false } };

export default async function SavedCombosPage() {
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login?next=/account/combos");

  const { data } = await db()
    .from("custom_combos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="container-x max-w-3xl py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold">
            <Layers className="h-5 w-5 text-mint" /> আমার কম্বো
          </h1>
          <p className="mt-1 text-[12.5px] text-sand-100/50">
            সেভ করা কম্বো এক ক্লিকে আবার কার্টে যোগ করুন।
          </p>
        </div>
        <Link href="/combos/build" className="btn-primary btn-sm">
          <Plus className="h-3.5 w-3.5" /> নতুন কম্বো
        </Link>
      </div>

      <SavedCombos
        initial={(data ?? []).map((c) => ({
          id: c.id,
          name_bn: c.name_bn,
          item_count: c.item_count,
          price_cached: Number(c.price_cached),
          repeat_interval: c.repeat_interval,
          created_at: c.created_at,
          items: (c.items ?? []) as Array<{
            productId: string;
            name_bn: string;
            unit: string;
            price: number;
            qty: number;
            image?: string | null;
          }>,
        }))}
      />
    </div>
  );
}
