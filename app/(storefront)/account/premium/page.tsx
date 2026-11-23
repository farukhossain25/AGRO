import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, MonitorSmartphone, Video } from "lucide-react";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { resolvePremiumState, premiumStatusLabelBn, tierLabelBn } from "@/lib/premium";
import { PushOptIn } from "@/components/push-opt-in";
import { PremiumControls } from "@/components/live/premium-controls";

export const dynamic = "force-dynamic";

export const metadata = { title: "প্রিমিয়াম সাবস্ক্রিপশন", robots: { index: false } };

export default async function AccountPremiumPage() {
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login?next=/account/premium");

  const state = await resolvePremiumState(user.id, user.role, undefined);

  const [{ data: subs }, { data: devices }] = await Promise.all([
    db()
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    db().from("premium_devices").select("*").eq("user_id", user.id).order("last_seen", { ascending: false }),
  ]);

  const history = subs ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-bold">প্রিমিয়াম সাবস্ক্রিপশন</h1>
        <p className="mt-1 text-[12.5px] text-sand-100/50">লাইভ খামার ক্যামেরা, ২ডি/৩ডি ম্যাপ ও দুধ লাইভ মনিটরিং।</p>
      </div>

      {/* current plan */}
      {state.subscription ? (
        <div
          className={`card border-mint/25 p-5 ${
            state.subscription.status === "grace" ? "bg-amber-500/5" : "bg-leaf-900/20"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-sand-100/40">বর্তমান প্ল্যান</p>
              <p className="mt-0.5 text-[16px] font-bold text-white">
                {tierLabelBn[state.subscription.tier] ?? state.subscription.tier} —{" "}
                {state.subscription.plan_name_bn}
              </p>
              <p className="mt-1 text-[12px] text-sand-100/55">
                {premiumStatusLabelBn[state.subscription.status]} · শেষ হবে{" "}
                {state.subscription.expires_at
                  ? new Date(state.subscription.expires_at).toLocaleDateString("bn-BD", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-mint">{state.daysLeft ?? 0}</p>
              <p className="text-[10.5px] text-sand-100/40">দিন বাকি</p>
            </div>
          </div>

          {state.subscription.status === "grace" && (
            <p className="mt-3 rounded-lg bg-amber-500/12 px-3 py-2 text-[11.5px] leading-relaxed text-amber-200">
              ⚠️ মেয়াদ শেষ হয়েছে, গ্রেস পিরিয়ড চলছে। এখনই রিনিউ করলে ক্যামেরা বন্ধ হবে না।
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/live/farms" className="btn-primary btn-sm">
              <Video className="h-3.5 w-3.5" /> লাইভ দেখুন
            </Link>
            <Link href="/live/plans" className="btn-ghost btn-sm">
              রিনিউ / আপগ্রেড
            </Link>
          </div>

          <PremiumControls
            subNo={state.subscription.sub_no}
            canCancel={state.subscription.status === "active"}
            autoRenew={Boolean(state.subscription.auto_renew)}
          />
        </div>
      ) : (
        <div className="card p-5 text-center">
          <p className="text-2xl">🎬</p>
          <p className="mt-2 text-[14px] font-semibold text-white">আপনার কোনো প্রিমিয়াম প্ল্যান নেই</p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-sand-100/50">
            ১০ মিনিট ফ্রি ট্রায়াল নিয়ে দেখুন, তারপর মাসিক ৳১৪৯ থেকে প্ল্যান নিন।
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/live/plans" className="btn-primary btn-sm">
              <CreditCard className="h-3.5 w-3.5" /> প্ল্যান দেখুন
            </Link>
            <Link href="/live/trial" className="btn-ghost btn-sm">
              ফ্রি ট্রায়াল
            </Link>
          </div>
        </div>
      )}

      <PushOptIn signedIn />

      {/* devices */}
      <div className="card p-5">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-white">
          <MonitorSmartphone className="h-4 w-4 text-mint" /> ডিভাইস
        </p>
        <p className="mt-1 text-[11.5px] text-sand-100/45">
          আপনার প্ল্যানে সর্বোচ্চ {state.deviceLimit}টি ডিভাইস চলবে।
        </p>
        <ul className="mt-3 space-y-1.5">
          {(devices ?? []).length === 0 ? (
            <li className="text-[11.5px] text-sand-100/35">এখনো কোনো ডিভাইস রেজিস্টার হয়নি</li>
          ) : (
            (devices ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="min-w-0 truncate text-[11.5px] text-sand-100/70">{d.label ?? "অজানা ডিভাইস"}</span>
                <span className="shrink-0 text-[10.5px] text-sand-100/35">
                  {d.last_seen ? new Date(d.last_seen).toLocaleDateString("bn-BD") : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* history */}
      <div className="card overflow-hidden">
        <p className="border-b border-white/5 px-4 py-3 text-[13px] font-bold text-white">সাবস্ক্রিপশন ইতিহাস</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11.5px]">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-sand-100/40">
              <tr>
                <th className="px-4 py-2 font-medium">সাব নং</th>
                <th className="px-4 py-2 font-medium">স্টেটাস</th>
                <th className="px-4 py-2 font-medium">শেষ</th>
                <th className="px-4 py-2 font-medium">টাকা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {history.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-mono text-[10.5px]">{s.sub_no}</td>
                  <td className="px-4 py-2">{premiumStatusLabelBn[s.status] ?? s.status}</td>
                  <td className="px-4 py-2 text-sand-100/45">
                    {s.expires_at ? new Date(s.expires_at).toLocaleDateString("bn-BD") : "—"}
                  </td>
                  <td className="px-4 py-2 text-mint">৳{Number(s.amount)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sand-100/35">
                    কোনো ইতিহাস নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
