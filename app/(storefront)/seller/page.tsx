import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, Package, ShoppingBag, TrendingUp } from "lucide-react";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { getSellerByUser, sellerStatusLabelBn, payoutStatusLabelBn } from "@/lib/sellers";
import { SellerProductManager } from "@/components/seller/product-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "সেলার ড্যাশবোর্ড",
  robots: { index: false, follow: false },
};

export default async function SellerDashboard() {
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login?next=/seller");

  const seller = await getSellerByUser(user.id).catch(() => null);
  if (!seller) redirect("/seller/apply");

  const client = db();
  const [{ data: products }, { data: subs }, { data: payouts }, { data: categories }] = await Promise.all([
    client.from("products").select("*").eq("seller_id", seller.id).order("created_at", { ascending: false }),
    client
      .from("sub_orders")
      .select("id, sub_no, subtotal, commission, seller_earning, status, created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(30),
    client
      .from("seller_payouts")
      .select("*")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(12),
    client.from("categories").select("id, name_bn").order("sort_order"),
  ]);

  const orders = subs ?? [];
  const gross = orders.reduce((n, o) => n + Number(o.subtotal ?? 0), 0);
  const commission = orders.reduce((n, o) => n + Number(o.commission ?? 0), 0);
  const net = orders.reduce((n, o) => n + Number(o.seller_earning ?? 0), 0);
  const paidOut = (payouts ?? [])
    .filter((p) => p.status === "paid")
    .reduce((n, p) => n + Number(p.net ?? 0), 0);

  const pendingCount = (products ?? []).filter((p) => p.approval_status === "pending").length;

  return (
    <div className="container-x py-8 sm:py-12">
      {/* header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-sand-100/40">সেলার ড্যাশবোর্ড</p>
          <h1 className="mt-0.5 text-[22px] font-bold sm:text-[28px]">{seller.name_bn}</h1>
          <p className="mt-1 flex items-center gap-2 text-[12px] text-sand-100/50">
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                seller.status === "approved"
                  ? "bg-leaf-600/20 text-leaf-200"
                  : seller.status === "pending"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-red-500/15 text-red-300"
              }`}
            >
              {sellerStatusLabelBn[seller.status]}
            </span>
            {seller.district} · কমিশন {Number(seller.commission_percent)}%
          </p>
        </div>
        <Link href={`/market/${seller.slug}`} className="btn-ghost btn-sm">
          পাবলিক স্টোর দেখুন →
        </Link>
      </div>

      {seller.status === "pending" && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-[12.5px] leading-relaxed text-amber-200">
          আপনার আবেদন যাচাই চলছে। অনুমোদনের আগে পণ্য যোগ করা যাবে না — সাধারণত ২৪–৪৮ ঘণ্টা লাগে।
        </div>
      )}

      {/* stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "মোট বিক্রি", value: `৳${Math.round(gross)}`, icon: TrendingUp, accent: "text-mint" },
          { label: "কমিশন কাটা", value: `৳${Math.round(commission)}`, icon: Banknote, accent: "text-amber-300" },
          { label: "আপনার আয়", value: `৳${Math.round(net)}`, icon: ShoppingBag, accent: "text-leaf-200" },
          { label: "পরিশোধিত", value: `৳${Math.round(paidOut)}`, icon: Banknote, accent: "text-sand-100/70" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <s.icon className={`h-4 w-4 ${s.accent}`} />
            <p className="mt-2 text-[10.5px] uppercase tracking-wide text-sand-100/40">{s.label}</p>
            <p className={`mt-0.5 text-lg font-bold ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* products */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-white">
              <Package className="h-4 w-4 text-mint" /> আমার পণ্য
              <span className="text-[11.5px] font-normal text-sand-100/40">
                ({products?.length ?? 0}টি{pendingCount ? ` · ${pendingCount}টি অপেক্ষমাণ` : ""})
              </span>
            </h2>
          </div>

          <SellerProductManager
            initial={products ?? []}
            categories={(categories ?? []).map((c) => ({ id: c.id, name_bn: c.name_bn }))}
            canAdd={seller.status === "approved"}
          />
        </section>

        {/* orders + payouts */}
        <aside className="space-y-5">
          <div className="card p-4">
            <h2 className="mb-3 text-[13px] font-bold text-white">সাম্প্রতিক অর্ডার</h2>
            {orders.length === 0 ? (
              <p className="text-[11.5px] text-sand-100/40">এখনো কোনো অর্ডার আসেনি</p>
            ) : (
              <ul className="space-y-2">
                {orders.slice(0, 8).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="font-mono text-sand-100/60">{o.sub_no}</span>
                    <span className="text-mint">৳{Math.round(Number(o.seller_earning))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h2 className="mb-3 text-[13px] font-bold text-white">পেমেন্ট</h2>
            {(payouts ?? []).length === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-sand-100/40">
                প্রতি সপ্তাহে অ্যাডমিন পেমেন্ট রিলিজ করেন। প্রথম পেমেন্ট অর্ডার ডেলিভারির ৭ দিন পর।
              </p>
            ) : (
              <ul className="space-y-2">
                {(payouts ?? []).map((p) => (
                  <li key={p.id} className="rounded-lg bg-white/[0.03] p-2.5 text-[11.5px]">
                    <div className="flex justify-between">
                      <span className="text-sand-100/60">
                        {p.period_from} → {p.period_to}
                      </span>
                      <span className="font-semibold text-mint">৳{Math.round(Number(p.net))}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-sand-100/35">
                      {payoutStatusLabelBn[p.status]} {p.method ? `· ${p.method}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-mint/20 bg-leaf-900/20 p-4">
            <p className="text-[12.5px] font-bold text-white">লাইভ ক্যামেরা চান?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-sand-100/50">
              আপনার খামারে ক্যামেরা বসিয়ে গ্রাহককে সরাসরি দেখানোর সুযোগ নিন — বিক্রি গড়ে ৩৪% বাড়ে।
            </p>
            <Link href="/seller/cameras" className="btn-ghost btn-sm mt-3 w-full">
              ক্যামেরা রিকোয়েস্ট
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
