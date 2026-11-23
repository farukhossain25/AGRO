import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Package, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getProducts } from "@/lib/data";
import { formatDateTimeBn, money, toBn } from "@/lib/format";
import type { Order } from "@/lib/types";
import { adminHref } from "@/lib/paths";

export const dynamic = "force-dynamic";

const statusTone: Record<string, string> = {
  received: "bg-white/[0.07] text-sand-100/70",
  packing: "bg-amber-500/15 text-amber-300",
  shipped: "bg-sky-500/15 text-sky-300",
  delivered: "bg-leaf-600/20 text-leaf-200",
  cancelled: "bg-red-500/15 text-red-300",
};

async function loadStats() {
  const client = db();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [todayOrders, weekOrders, allOrders, customers, lowStock] = await Promise.all([
    client.from("orders").select("id, total, status, payment_status").gte("created_at", todayStart.toISOString()),
    client.from("orders").select("id, total, status, created_at").gte("created_at", weekStart.toISOString()),
    client.from("orders").select("id, total, status").limit(1000),
    client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    client
      .from("products")
      .select("id, name_bn, stock, unit, slug")
      .eq("is_active", true)
      .lte("stock", 10)
      .order("stock", { ascending: true })
      .limit(8),
  ]);

  const todayList = (todayOrders.data ?? []) as { total: number; status: string }[];
  const weekList = (weekOrders.data ?? []) as { total: number; status: string }[];
  const allList = (allOrders.data ?? []) as { total: number; status: string }[];

  const sum = (rows: { total: number; status?: string }[]) =>
    rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Number(r.total), 0);

  return {
    todayCount: todayList.length,
    todaySales: sum(todayList),
    weekSales: sum(weekList),
    totalSales: sum(allList),
    totalOrders: allList.length,
    pending: allList.filter((o) => o.status === "received" || o.status === "packing").length,
    customers: customers.count ?? 0,
    lowStock: (lowStock.data ?? []) as { id: string; name_bn: string; stock: number; unit: string; slug: string }[],
  };
}

export default async function AdminDashboard() {
  let stats: Awaited<ReturnType<typeof loadStats>> | null = null;
  let recent: Order[] = [];
  let dbError: string | null = null;

  try {
    stats = await loadStats();
    const { data } = await db()
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);
    recent = (data ?? []) as unknown as Order[];
  } catch (error) {
    dbError = (error as Error).message;
  }

  // Fall back to the static catalogue so the dashboard is never blank offline
  const fallbackProducts = await getProducts({}).catch(() => []);
  const lowStock = stats?.lowStock?.length
    ? stats.lowStock
    : fallbackProducts.filter((p) => p.stock <= 10).slice(0, 8).map((p) => ({
        id: p.id,
        name_bn: p.name_bn,
        stock: p.stock,
        unit: p.unit,
        slug: p.slug,
      }));

  const cards = [
    {
      label: "আজকের বিক্রয়",
      value: money(stats?.todaySales ?? 0, true),
      sub: `${toBn(stats?.todayCount ?? 0)}টি অর্ডার`,
      Icon: TrendingUp,
      href: adminHref("orders"),
    },
    {
      label: "এই সপ্তাহে",
      value: money(stats?.weekSales ?? 0, true),
      sub: "গত ৭ দিন",
      Icon: ShoppingCart,
      href: adminHref("reports"),
    },
    {
      label: "মোট অর্ডার",
      value: toBn(stats?.totalOrders ?? 0),
      sub: `${toBn(stats?.pending ?? 0)}টি প্রসেসিং-এ`,
      Icon: Package,
      href: adminHref("orders"),
    },
    {
      label: "কাস্টমার",
      value: toBn(stats?.customers ?? 0),
      sub: "নিবন্ধিত গ্রাহক",
      Icon: Users,
      href: adminHref("customers"),
    },
  ];

  return (
    <div className="space-y-5">
      {dbError ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-[12px] leading-relaxed text-amber-200/90">
          ⚠️ ডেটাবেস সংযোগ পাওয়া যায়নি — ক্যাটালগ ডেটা দিয়ে ড্যাশবোর্ড দেখানো হচ্ছে। Supabase কী যাচাই করুন।
          <br />
          <span className="font-mono text-[10.5px] opacity-70">{dbError}</span>
        </div>
      ) : null}

      <div>
        <h1 className="text-xl font-bold sm:text-2xl">ড্যাশবোর্ড</h1>
        <p className="mt-0.5 text-[12px] text-sand-100/45">আজকের ব্যবসার সারসংক্ষেপ</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, sub, Icon, href }) => (
          <Link key={label} href={href} className="card card-hover p-4">
            <div className="flex items-start justify-between">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-leaf-600/15 text-leaf-300">
                <Icon className="h-4 w-4" />
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-sand-100/25" />
            </div>
            <p className="mt-2.5 text-lg font-bold leading-tight">{value}</p>
            <p className="text-[11px] text-sand-100/45">{label}</p>
            <p className="mt-0.5 text-[10px] text-sand-100/30">{sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* recent orders */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-[13.5px] font-bold">সাম্প্রতিক অর্ডার</h2>
            <Link href={adminHref("orders")} className="text-[11.5px] font-semibold text-leaf-300">সব দেখুন →</Link>
          </div>

          {recent.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-sand-100/40">
                  <tr>
                    <th className="px-4 py-2 font-medium">অর্ডার</th>
                    <th className="px-2 py-2 font-medium">কাস্টমার</th>
                    <th className="px-2 py-2 font-medium">স্টেটাস</th>
                    <th className="px-4 py-2 text-right font-medium">মোট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {recent.map((o) => (
                    <tr key={o.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <Link href={adminHref(`orders?q=${o.order_no}`)} className="font-mono text-[11px] text-leaf-200">
                          {o.order_no}
                        </Link>
                        <p className="text-[9.5px] text-sand-100/30">{formatDateTimeBn(o.created_at)}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="truncate">{o.customer_name}</p>
                        <p className="text-[9.5px] text-sand-100/30">{o.phone}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`badge ${statusTone[o.status] ?? statusTone.received} !text-[9px]`}>
                          {o.status === "received" ? "গৃহীত" : o.status === "packing" ? "প্যাকিং" : o.status === "shipped" ? "পথে" : o.status === "delivered" ? "সম্পন্ন" : "বাতিল"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{money(Number(o.total), true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-10 text-center text-[12px] text-sand-100/40">এখনো কোনো অর্ডার নেই</p>
          )}
        </section>

        {/* low stock */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              কম স্টক
            </h2>
            <Link href={adminHref("products")} className="text-[11.5px] font-semibold text-leaf-300">ম্যানেজ →</Link>
          </div>

          {lowStock.length ? (
            <ul className="divide-y divide-white/[0.04]">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12px]">{p.name_bn}</p>
                    <p className="text-[9.5px] text-sand-100/30">{p.unit}</p>
                  </div>
                  <span
                    className={`badge shrink-0 !text-[9.5px] ${
                      p.stock <= 0 ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {p.stock <= 0 ? "শেষ" : `${toBn(p.stock)} বাকি`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-[12px] text-sand-100/40">সব পণ্যের স্টক ঠিক আছে ✓</p>
          )}
        </section>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {[
          { href: adminHref("products"), label: "নতুন পণ্য যোগ করুন" },
          { href: adminHref("orders"), label: "অর্ডার প্রসেস করুন" },
          { href: adminHref("coupons"), label: "কুপন তৈরি করুন" },
          { href: adminHref("reports"), label: "CSV রিপোর্ট" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="btn-ghost btn-sm justify-center">
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
