import Link from "next/link";
import { db, isDbConfigured } from "@/lib/db";
import { premiumStatusLabelBn, tierLabelBn } from "@/lib/premium";
import { adminHref } from "@/lib/paths";
import { PremiumManager, type AdminPremiumSub } from "@/components/admin/premium-manager";

export const dynamic = "force-dynamic";

/* ==========================================================================
   /foisal/premium — the premium subscription desk
   --------------------------------------------------------------------------
   Two halves:

     1. the counters (active, on trial, devices, live viewers)
     2. the payment queue — PremiumManager. Every premium purchase is a manual
        payment, so this is where the owner verifies the TrxID and either puts
        the plan live or rejects it with a reason the customer will read.
        The row is only *rendered* here; the decision goes through
        PATCH /api/foisal/premium-subscriptions (premium.manage permission,
        audited, notifies the customer).
   ========================================================================== */

type Sub = AdminPremiumSub & {
  started_at: string | null;
  expires_at: string | null;
};

export default async function AdminPremiumPage() {
  let subs: AdminPremiumSub[] = [];
  let trials = 0;
  let devices = 0;
  let sessions = 0;

  if (isDbConfigured()) {
    try {
      const client = db();
      const [{ data }, { count: trialCount }, { count: deviceCount }, { count: sessionCount }] =
        await Promise.all([
          client
            .from("user_subscriptions")
            .select("id, sub_no, user_id, plan_name_bn, tier, amount, status, started_at, expires_at, payment_method, payment_ref, cancel_reason, created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          client.from("trials").select("id", { count: "exact", head: true }),
          client.from("premium_devices").select("id", { count: "exact", head: true }),
          client
            .from("stream_tokens")
            .select("jti", { count: "exact", head: true })
            .gt("expires_at", new Date().toISOString()),
        ]);

      const raw = (data ?? []) as unknown as Sub[];
      trials = trialCount ?? 0;
      devices = deviceCount ?? 0;
      sessions = sessionCount ?? 0;

      // hydrate customer names + phones for the payment cards
      const ids = Array.from(new Set(raw.map((r) => r.user_id).filter(Boolean))) as string[];
      const map = new Map<string, { full_name: string | null; phone: string | null }>();
      if (ids.length) {
        const { data: users } = await client.from("profiles").select("id, full_name, phone").in("id", ids);
        for (const u of users ?? []) map.set(u.id, { full_name: u.full_name, phone: u.phone });
      }
      subs = raw.map((r) => ({
        ...r,
        amount: Number(r.amount),
        customer_name: r.user_id ? map.get(r.user_id)?.full_name ?? null : null,
        customer_phone: r.user_id ? map.get(r.user_id)?.phone ?? null : null,
      }));
    } catch {
      /* offline — the manager renders its empty state */
    }
  }

  const active = subs.filter((s) => s.status === "active" || s.status === "grace");
  const pending = subs.filter((s) => s.status === "pending");
  /* Monthly run-rate: each active sub's amount spread over its own term. */
  const mrr = active.reduce((n, s) => n + Number(s.amount) / Math.max(1, Math.round(daysBetween(s.started_at, s.expires_at) / 30)), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">প্রিমিয়াম সাবস্ক্রিপশন</h1>
          <p className="text-[12px] text-sand-100/45">
            {active.length}টি সক্রিয় · আনুমানিক মাসিক আয় ৳{Math.round(mrr)}
          </p>
        </div>
        {pending.length > 0 ? (
          <span className="badge bg-sky-500/15 text-sky-200">
            {pending.length}টি পেমেন্ট যাচাইয়ের অপেক্ষায়
          </span>
        ) : null}
      </div>

      {/* tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "সক্রিয় সাবস্ক্রিপশন", value: active.length, tone: "text-mint" },
          { label: "ফ্রি ট্রায়াল শুরু হয়েছে", value: trials, tone: "text-amber-300" },
          { label: "রেজিস্টার্ড ডিভাইস", value: devices, tone: "text-sky-300" },
          { label: "এখন লাইভ দর্শক", value: sessions, tone: "text-leaf-200" },
        ].map((t) => (
          <div key={t.label} className="card p-4">
            <p className="text-[10.5px] uppercase tracking-wide text-sand-100/40">{t.label}</p>
            <p className={`mt-1 text-xl font-bold ${t.tone}`}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={adminHref("plans")} className="btn-ghost btn-sm">
          প্ল্যান ম্যানেজ
        </Link>
        <Link href={adminHref("codes")} className="btn-ghost btn-sm">
          অ্যাক্সেস কোড
        </Link>
        <Link href="/account/premium" className="btn-ghost btn-sm">
          গ্রাহক যা দেখেন
        </Link>
      </div>

      {/* the payment queue — approve / reject with a reason */}
      <PremiumManager initial={subs} />

      {/* legend */}
      <p className="px-1 text-[11px] leading-relaxed text-sand-100/35">
        চালু করার নিয়ম: গ্রাহকের দেওয়া TrxID বিকাশ/নগদের এসএমএসের সাথে মিলিয়ে দেখুন → <b>যাচাই করে চালু করুন</b>{" "}
        → গ্রাহক তাঁর প্ল্যানের পুরো মেয়াদ (৩০ / ১৮২ / ৩৬৫ দিন) পাবেন এবং সাথে সাথেই লাইভ ক্যামেরার অ্যাক্সেস
        পাবেন। পেমেন্ট না মিললে <b>বাতিল করুন</b> — যে কারণ লিখবেন, গ্রাহক সেটি{" "}
        {premiumStatusLabelBn.cancelled} হিসেবে নিজের অ্যাকাউন্ট পেজে দেখবেন। প্ল্যানের টায়ার:{" "}
        {Object.values(tierLabelBn).join(" · ")}।
      </p>
    </div>
  );
}

function daysBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 30;
  return Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}
