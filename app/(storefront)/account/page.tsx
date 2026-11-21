import Link from "next/link";
import { ArrowRight, MapPin, Package, Repeat } from "lucide-react";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { getOrdersForUser } from "@/lib/data";
import { formatDateBn, money } from "@/lib/format";
import type { Order, Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AccountDashboard() {
  const user = await currentUser();
  if (!user) return null;

  const [orders, subsResult, addressesResult] = await Promise.all([
    getOrdersForUser(user.id).catch(() => [] as (Order & { order_items: [] })[]),
    db().from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    db().from("addresses").select("id").eq("user_id", user.id),
  ]);

  const subs = (subsResult.data ?? []) as Subscription[];
  const addressCount = (addressesResult.data ?? []).length;
  const activeSubs = subs.filter((s) => s.status === "active").length;
  const spent = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total), 0);

  const stats = [
    { label: "মোট অর্ডার", value: String(orders.length), href: "/account/orders", Icon: Package },
    { label: "সক্রিয় সাবস্ক্রিপশন", value: String(activeSubs), href: "/account/subscriptions", Icon: Repeat },
    { label: "সেভ করা ঠিকানা", value: String(addressCount), href: "/account/addresses", Icon: MapPin },
    { label: "মোট খরচ", value: money(spent, true), href: "/account/orders", Icon: Package },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, href, Icon }) => (
          <Link key={label} href={href} className="card card-hover p-4">
            <Icon className="h-4 w-4 text-leaf-400" />
            <p className="mt-2.5 text-lg font-bold leading-tight">{value}</p>
            <p className="mt-0.5 text-[11px] text-sand-100/45">{label}</p>
          </Link>
        ))}
      </div>

      {/* recent orders */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">সাম্প্রতিক অর্ডার</h2>
          <Link href="/account/orders" className="text-[12px] font-semibold text-leaf-300 hover:text-leaf-200">
            সব দেখুন →
          </Link>
        </div>

        {orders.length ? (
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {orders.slice(0, 5).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[12.5px] font-semibold text-leaf-200">{o.order_no}</p>
                  <p className="text-[11px] text-sand-100/45">{formatDateBn(o.created_at)}</p>
                </div>
                <span className="badge bg-white/[0.06] text-sand-100/70">
                  {o.status === "received" ? "গৃহীত" : o.status === "packing" ? "প্যাকিং" : o.status === "shipped" ? "পথে" : o.status === "delivered" ? "সম্পন্ন" : "বাতিল"}
                </span>
                <p className="text-[13px] font-bold">{money(Number(o.total), true)}</p>
                <Link href={`/track?order=${o.order_no}`} className="text-[11.5px] text-leaf-300 hover:underline">
                  ট্র্যাক
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 py-8 text-center">
            <p className="text-[12.5px] text-sand-100/45">এখনো কোনো অর্ডার নেই</p>
            <Link href="/products" className="btn-primary btn-sm mt-3">
              প্রথম অর্ডার করুন <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* subscriptions */}
      {subs.length ? (
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">সাবস্ক্রিপশন</h2>
            <Link href="/account/subscriptions" className="text-[12px] font-semibold text-leaf-300">সব দেখুন →</Link>
          </div>
          <ul className="mt-3 space-y-2">
            {subs.slice(0, 3).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
                <div>
                  <p className="text-[12.5px] font-semibold">{s.package_name}</p>
                  <p className="font-mono text-[10.5px] text-sand-100/40">{s.sub_no}</p>
                </div>
                <span
                  className={`badge ${
                    s.status === "active"
                      ? "bg-leaf-600/20 text-leaf-200"
                      : s.status === "paused"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-red-500/15 text-red-300"
                  }`}
                >
                  {s.status === "active" ? "সক্রিয়" : s.status === "paused" ? "পজ" : "বাতিল"}
                </span>
                <p className="text-[12.5px] font-bold">{money(Number(s.price_monthly), true)}/মাস</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
