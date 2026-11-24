import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, Eye, Package, ShoppingBag, Store, TrendingUp } from "lucide-react";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import {
  getSellerByUser,
  approvePendingSellerProducts,
  sellerStatusLabelBn,
  payoutStatusLabelBn,
  orderStatusLabelBn,
} from "@/lib/sellers";
import { ensureSellerFarm, type SellerFarmLink } from "@/lib/seller-farm";
import { toBn } from "@/lib/format";
import { Printer } from "lucide-react";
import { SellerProductManager } from "@/components/seller/product-manager";
import { StoreBranding } from "@/components/seller/store-branding";

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

  // Sellers approved before farms were auto-created have no farm yet → the
  // public "আমাদের খামার" strip and the live page had nothing to show. This
  // is idempotent: once linked it is a single primary-key read.
  const farm: SellerFarmLink | null =
    seller.status === "approved" ? await ensureSellerFarm(seller).catch(() => null) : null;

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

  // Cancelled orders are not sales: they are listed (so the seller sees why)
  // but never counted.
  const orders = (subs ?? []).filter((o) => o.status !== "cancelled");
  const cancelledCount = (subs ?? []).length - orders.length;
  const gross = orders.reduce((n, o) => n + Number(o.subtotal ?? 0), 0);
  const commission = orders.reduce((n, o) => n + Number(o.commission ?? 0), 0);
  const net = orders.reduce((n, o) => n + Number(o.seller_earning ?? 0), 0);
  const paidOut = (payouts ?? [])
    .filter((p) => p.status === "paid")
    .reduce((n, p) => n + Number(p.amount ?? 0), 0);

  // Products submitted before per-product review was removed — publish them
  // now that the seller is verified (idempotent, pending rows only).
  let productRows = products ?? [];
  if (seller.status === "approved" && productRows.some((p) => p.approval_status === "pending")) {
    const published = await approvePendingSellerProducts(seller.id).catch(() => 0);
    if (published) {
      productRows = productRows.map((p) =>
        p.approval_status === "pending" ? { ...p, approval_status: "approved" } : p
      );
    }
  }

  return (
    <div className="container-x py-8 sm:py-12">
      {/* header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          {seller.logo ? (
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-white/15 sm:h-14 sm:w-14">
              <Image src={seller.logo} alt="" fill sizes="56px" className="object-contain p-0.5" unoptimized />
            </span>
          ) : null}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-sand-100/40">সেলার ড্যাশবোর্ড</p>
            <h1 className="mt-0.5 text-[22px] font-bold sm:text-[28px]">{seller.name_bn}</h1>
            <p className="mt-1 flex items-center gap-2 text-[12px] text-sand-100/50">
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                  seller.status === "approved"
                    ? "bg-leaf-600/20 text-leaf-700"
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
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/seller/reviews" className="btn-ghost btn-sm min-h-[44px]">
            রিভিউ ও অভিযোগ
          </Link>
          {seller.status === "approved" ? (
            <Link href={`/market/${seller.slug}`} className="btn-ghost btn-sm min-h-[44px]">
              <Eye className="h-4 w-4" /> আমার স্টোর পৃষ্ঠা দেখুন
            </Link>
          ) : null}
        </div>
      </div>

      {/* The seller's own public URLs — this is the page they said they couldn't find. */}
      {seller.status === "approved" ? (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-neu-accent/25 bg-neu-accent-soft/60 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-neu-ink">
              <Store className="h-3.5 w-3.5 text-neu-accent-strong" /> আপনার পাবলিক স্টোর
            </p>
            <p className="mt-0.5 truncate font-mono text-[11.5px] text-neu-muted">/market/{seller.slug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/market/${seller.slug}`} className="btn-primary btn-sm min-h-[40px]">
              স্টোর খুলুন
            </Link>
            <Link href="/market" className="btn-ghost btn-sm min-h-[40px]">
              মার্কেটপ্লেসে আমার অবস্থান
            </Link>
          </div>
        </div>
      ) : seller.status === "rejected" ? (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/8 p-4 text-[12.5px] leading-relaxed text-red-200">
          আপনার আবেদন বাতিল হয়েছে{seller.rejection_reason ? `: ${seller.rejection_reason}` : ""}।{" "}
          <Link href="/seller/apply" className="font-semibold underline underline-offset-2">
            তথ্য ঠিক করে আবার আবেদন করুন
          </Link>
        </div>
      ) : seller.status === "suspended" ? (
        <p className="mb-5 text-[11.5px] text-sand-100/50">
          আপনার স্টোর (<span className="font-mono">/market/{seller.slug}</span>) ও খামার পৃষ্ঠা স্থগিত করা হয়েছে —
          বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।
        </p>
      ) : null}

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
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-neu-ink">
              <Package className="h-4 w-4 text-mint" /> আমার পণ্য
            </h2>
          </div>

          <SellerProductManager
            initial={productRows}
            categories={(categories ?? []).map((c) => ({ id: c.id, name_bn: c.name_bn }))}
            canAdd={seller.status === "approved"}
          />
        </section>

        {/* orders + payouts */}
        <aside className="space-y-5">
          <StoreBranding
            key={seller.id}
            slug={seller.slug}
            name={seller.name_bn}
            initialLogo={seller.logo}
            initialBanner={seller.banner}
            live={seller.status === "approved"}
          />

          <div className="card p-4">
            <h2 className="mb-3 flex items-center justify-between text-[13px] font-bold text-neu-ink">
              <span>সাম্প্রতিক অর্ডার</span>
              {cancelledCount ? (
                <span className="text-[10.5px] font-normal text-sand-100/45">{toBn(cancelledCount)}টি বাতিল (হিসাবে নেই)</span>
              ) : null}
            </h2>
            {orders.length === 0 ? (
              <p className="text-[11.5px] text-sand-100/40">এখনো কোনো অর্ডার আসেনি</p>
            ) : (
              <ul className="space-y-2">
                {orders.slice(0, 8).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sand-100/60">{o.sub_no}</p>
                      <p
                        className={`text-[10px] font-medium ${
                          o.status === "delivered" ? "text-leaf-300" : o.status === "shipped" ? "text-sky-300" : "text-amber-300"
                        }`}
                      >
                        {orderStatusLabelBn[o.status] ?? o.status}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-mint">৳{Math.round(Number(o.seller_earning))}</span>
                    <Link
                      href={`/seller/orders/${encodeURIComponent(o.sub_no)}/receipt`}
                      className="neu-pill shrink-0 px-2 py-1 text-[10px] font-semibold text-neu-accent-strong transition hover:text-neu-accent"
                      aria-label={`${o.sub_no} রসিদ প্রিন্ট করুন`}
                    >
                      <Printer className="h-3 w-3" /> রসিদ
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h2 className="mb-3 text-[13px] font-bold text-neu-ink">পেমেন্ট</h2>
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
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString("bn-BD") : new Date(p.created_at).toLocaleDateString("bn-BD")}
                      </span>
                      <span className="font-semibold text-mint">৳{Math.round(Number(p.amount))}</span>
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
            <p className="text-[12.5px] font-bold text-neu-ink">আপনার খামার</p>
            {farm ? (
              <>
                <p className="mt-1 text-[12px] font-semibold text-mint">{farm.name_bn}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-sand-100/50">
                  অনুমোদনের সাথে সাথে "আমাদের খামার"-এ স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে। উপরের "স্টোরের লোগো ও
                  ব্যানার" থেকে দেওয়া ছবি এখানেও দেখা যাবে।
                </p>
                <div className="mt-3 grid gap-1.5">
                  <Link href={`/live/farms/${farm.slug}`} className="btn-ghost btn-sm w-full">
                    লাইভ ক্যামেরা পৃষ্ঠা →
                  </Link>
                  <Link href="/farm" className="btn-ghost btn-sm w-full">
                    "আমাদের খামার" পৃষ্ঠায় দেখুন →
                  </Link>
                </div>
              </>
            ) : (
              <p className="mt-1 text-[11px] leading-relaxed text-sand-100/50">
                অনুমোদিত হলে আপনার খামার স্বয়ংক্রিয়ভাবে "আমাদের খামার"-এ যুক্ত হবে।
              </p>
            )}
            <Link href="/seller/cameras" className="btn-primary btn-sm mt-3 w-full">
              লাইভ ক্যামেরা রিকোয়েস্ট
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
