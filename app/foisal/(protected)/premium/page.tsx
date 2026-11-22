import Link from "next/link";
import { db, isDbConfigured } from "@/lib/db";
import { premiumStatusLabelBn, tierLabelBn } from "@/lib/premium";
import { adminHref } from "@/lib/paths";

export const dynamic = "force-dynamic";

type Sub = {
  id: string;
  sub_no: string;
  user_id: string | null;
  plan_name_bn: string;
  tier: string;
  amount: number;
  status: string;
  started_at: string | null;
  expires_at: string | null;
  grace_until: string | null;
  payment_method: string | null;
  device_limit: number;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-leaf-600/20 text-leaf-200",
  grace: "bg-amber-500/15 text-amber-300",
  pending: "bg-sky-500/15 text-sky-300",
  expired: "bg-white/[0.07] text-sand-100/45",
  cancelled: "bg-red-500/15 text-red-300",
};

export default async function AdminPremiumPage() {
  let subs: Sub[] = [];
  let trials = 0;
  let devices = 0;
  let sessions = 0;

  if (isDbConfigured()) {
    try {
      const client = db();
      const [{ data }, { count: trialCount }, { count: deviceCount }, { count: sessionCount }] =
        await Promise.all([
          client.from("premium_subscriptions").select("*").order("created_at", { ascending: false }).limit(200),
          client.from("trial_grants").select("id", { count: "exact", head: true }),
          client.from("premium_devices").select("id", { count: "exact", head: true }),
          client
            .from("stream_sessions")
            .select("jti", { count: "exact", head: true })
            .gt("expires_at", new Date().toISOString()),
        ]);

      const raw = (data ?? []) as Sub[];
      trials = trialCount ?? 0;
      devices = deviceCount ?? 0;
      sessions = sessionCount ?? 0;

      // hydrate customer names for the table
      const ids = Array.from(new Set(raw.map((r) => r.user_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: users } = await client.from("users").select("id, name, phone").in("id", ids);
        const map = new Map((users ?? []).map((u) => [u.id, u]));
        subs = raw.map((r) => ({
          ...r,
          customer_name: r.user_id ? map.get(r.user_id)?.name ?? null : null,
          customer_phone: r.user_id ? map.get(r.user_id)?.phone ?? null : null,
        }));
      } else {
        subs = raw;
      }
    } catch {
      /* offline */
    }
  }

  const active = subs.filter((s) => s.status === "active");
  const mrr = active.reduce(
    (n, s) => n + Number(s.amount) / Math.max(1, Math.round(daysBetween(s.started_at, s.expires_at) / 30)),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">প্রিমিয়াম সাবস্ক্রিপশন</h1>
        <p className="text-[12px] text-sand-100/45">
          {active.length}টি সক্রিয় · আনুমানিক মাসিক আয় ৳{Math.round(mrr)}
        </p>
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
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-sand-100/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">সাব নং</th>
                <th className="px-3 py-2.5 font-medium">গ্রাহক</th>
                <th className="px-3 py-2.5 font-medium">প্ল্যান</th>
                <th className="px-3 py-2.5 font-medium">স্টেটাস</th>
                <th className="px-3 py-2.5 font-medium">শুরু</th>
                <th className="px-3 py-2.5 font-medium">শেষ</th>
                <th className="px-3 py-2.5 font-medium">টাকা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-mono text-[11px]">{s.sub_no}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-[12px] text-sand-100/80">{s.customer_name ?? "—"}</p>
                    <p className="text-[10.5px] text-sand-100/40">{s.customer_phone ?? ""}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-[11.5px]">{s.plan_name_bn}</p>
                    <p className="text-[10px] text-sand-100/40">{tierLabelBn[s.tier] ?? s.tier}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_TONE[s.status] ?? ""}`}>
                      {premiumStatusLabelBn[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-sand-100/50">
                    {s.started_at ? new Date(s.started_at).toLocaleDateString("bn-BD") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-sand-100/50">
                    {s.expires_at ? new Date(s.expires_at).toLocaleDateString("bn-BD") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[11.5px] text-mint">৳{Number(s.amount)}</td>
                </tr>
              ))}
              {subs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[12px] text-sand-100/40">
                    এখনো কোনো প্রিমিয়াম সাবস্ক্রিপশন নেই —{" "}
                    <Link href="/live/plans" className="text-mint hover:underline">
                      প্ল্যান পেজ
                    </Link>{" "}
                    দেখুন
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

function daysBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 30;
  return Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}
