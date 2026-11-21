import Link from "next/link";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { formatDateBn, money } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { SubscriptionControls } from "@/components/subscription-controls";
import type { Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

const freqLabels: Record<string, string> = {
  weekly: "সাপ্তাহিক",
  biweekly: "পাক্ষিক",
  monthly: "মাসিক",
};

export default async function SubscriptionsPage() {
  const user = await currentUser();
  if (!user) return null;

  const { data } = await db()
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const subs = (data ?? []) as Subscription[];

  if (!subs.length) {
    return (
      <EmptyState
        icon="🔁"
        title="কোনো সাবস্ক্রিপশন নেই"
        body="ফ্যামিলি প্যাকেজ নিলে প্রতি সপ্তাহে তাজা বাজার স্বয়ংক্রিয়ভাবে পৌঁছে যাবে।"
        action={<Link href="/subscription" className="btn-primary">প্যাকেজ দেখুন</Link>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {subs.map((sub) => (
        <article key={sub.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[14px] font-bold">{sub.package_name}</p>
              <p className="font-mono text-[10.5px] text-sand-100/40">{sub.sub_no}</p>
            </div>
            <span
              className={`badge ${
                sub.status === "active"
                  ? "bg-leaf-600/20 text-leaf-200"
                  : sub.status === "paused"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-red-500/15 text-red-300"
              }`}
            >
              {sub.status === "active" ? "সক্রিয়" : sub.status === "paused" ? "পজ করা" : "বাতিল"}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
            <div>
              <dt className="text-[10.5px] uppercase tracking-wider text-sand-100/35">সদস্য</dt>
              <dd className="font-medium">{sub.members} জন</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-wider text-sand-100/35">ফ্রিকোয়েন্সি</dt>
              <dd className="font-medium">{freqLabels[sub.frequency]}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-wider text-sand-100/35">শুরু</dt>
              <dd className="font-medium">{formatDateBn(sub.start_date)}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-wider text-sand-100/35">মাসিক পেমেন্ট</dt>
              <dd className="font-bold text-leaf-200">{money(Number(sub.price_monthly), true)}</dd>
            </div>
          </dl>

          <p className="mt-2.5 text-[11.5px] text-sand-100/45">
            {sub.address}, {sub.upazila}, {sub.district}
          </p>

          {sub.status !== "cancelled" ? (
            <SubscriptionControls subNo={sub.sub_no} status={sub.status} />
          ) : null}
        </article>
      ))}
    </div>
  );
}
