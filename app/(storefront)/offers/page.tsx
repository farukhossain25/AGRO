import type { Metadata } from "next";
import Link from "next/link";
import { Copy, Sparkles, Tag, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import type { Coupon } from "@/lib/types";
import { alternatesFor } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "অফার ও কুপন কোড",
  description: "বিশ্বাস এগ্রোর চলমান অফার ও কুপন কোড — প্রথম অর্ডারে ছাড়, ফ্রি ডেলিভারি ও সাপ্তাহিক ডিল।",
  alternates: alternatesFor("/offers"),
};

async function loadCoupons(): Promise<Coupon[]> {
  try {
    const { data } = await db()
      .from("coupons")
      .select("*")
      .eq("is_active", true)
      /* `assigned` / `influencer` codes are handed to named accounts. The
         page is public and cached for 5 minutes — publishing them here would
         defeat the whole restriction. */
      .eq("audience", "all")
      .order("value", { ascending: false });
    return (data ?? []) as Coupon[];
  } catch {
    return [];
  }
}

export default async function OffersPage() {
  /* An expired or used-up code must not look available. The window and the
     cap are checked here because this page is a plain read — the real gate is
     coupon_allows_user() at checkout. */
  const now = Date.now();
  const coupons = (await loadCoupons()).filter((c) => {
    if (c.starts_at && new Date(c.starts_at).getTime() > now) return false;
    if (c.expires_at && new Date(c.expires_at).getTime() < now) return false;
    if (c.usage_limit != null && Number(c.used_count ?? 0) >= Number(c.usage_limit)) return false;
    return true;
  });

  return (
    <div className="container-x py-8 sm:py-12">
      <header className="max-w-2xl">
        <span className="eyebrow mb-3">
          <Sparkles className="h-3.5 w-3.5" /> চলমান অফার
        </span>
        <h1 className="text-[26px] font-bold sm:text-4xl">কুপন ও অফার</h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-sand-100/55">
          চেকআউটে কুপন কোডটি লিখে ছাড় নিন। একবারে একটি কুপন প্রযোজ্য।
        </p>
      </header>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => (
          <article key={c.id} className="card relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-leaf-500/10 blur-2xl" />
            <div className="flex items-start justify-between gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
                <Tag className="h-5 w-5" />
              </span>
              <span className="badge bg-leaf-600/20 text-leaf-700">
                {c.type === "percent" ? `${Number(c.value)}% ছাড়` : `${money(Number(c.value), true)} ছাড়`}
              </span>
            </div>

            <p className="mt-3 font-mono text-lg font-bold tracking-wider text-leaf-200">{c.code}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-sand-100/55">
              ন্যূনতম অর্ডার {money(Number(c.min_order), true)}
              {c.max_discount ? ` · সর্বোচ্চ ছাড় ${money(Number(c.max_discount), true)}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-sand-100/35">
              {c.usage_limit ? `মোট ${c.usage_limit} জন ব্যবহার করতে পারবেন · ` : ""}
              প্রতি অ্যাকাউন্টে একবার
            </p>

            <CopyCode code={c.code} />
          </article>
        ))}

        <article className="card flex flex-col justify-center border-neu-accent/25 bg-gradient-to-br from-neu-accent-soft to-neu-raised p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-500/25 text-leaf-200">
            <Truck className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[14.5px] font-bold">৳১,২০০+ অর্ডারে ফ্রি ডেলিভারি</p>
          <p className="mt-1 text-[12px] leading-relaxed text-sand-100/60">
            কোনো কুপন লাগবে না — ঢাকা সিটির ভেতরে স্বয়ংক্রিয়ভাবে প্রযোজ্য।
          </p>
        </article>
      </div>

      <div className="mt-8 text-center">
        <Link href="/products" className="btn-primary">কেনাকাটা শুরু করুন</Link>
      </div>
    </div>
  );
}

function CopyCode({ code }: { code: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-leaf-500/40 bg-leaf-600/5 px-3 py-2">
      <span className="font-mono text-[13px] font-bold text-leaf-200">{code}</span>
      <span className="ml-auto flex items-center gap-1 text-[10.5px] text-sand-100/40">
        <Copy className="h-3 w-3" /> চেকআউটে লিখুন
      </span>
    </div>
  );
}
