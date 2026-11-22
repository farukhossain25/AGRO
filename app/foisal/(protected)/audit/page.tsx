import { db, dbUsable } from "@/lib/db";
import { formatDateBn } from "@/lib/format";
import { roleLabelBn } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";
import { ADMIN_BASE } from "@/lib/paths";

export const dynamic = "force-dynamic";

export const metadata = { title: "অডিট লগ", robots: { index: false, follow: false } };

type AuditRow = {
  id: number;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
};

const ACTION_BN: Record<string, string> = {
  create: "তৈরি",
  update: "পরিবর্তন",
  delete: "মুছে ফেলা",
  login: "লগইন",
  logout: "লগআউট",
  invite: "ইনভাইট",
  role: "রোল বদল",
  suspend: "স্থগিত",
  export: "এক্সপোর্ট",
  "admin.login": "অ্যাডমিন লগইন",
};

const ENTITY_BN: Record<string, string> = {
  products: "পণ্য",
  orders: "অর্ডার",
  users: "ইউজার",
  profiles: "প্রোফাইল",
  cms_pages: "সাইড পেজ",
  faq_items: "প্রশ্ন-উত্তর",
  seo_meta: "SEO",
  sellers: "সেলার",
  reviews: "রিভিউ",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 50;

  let rows: AuditRow[] = [];
  let total = 0;

  if (dbUsable()) {
    try {
      let q = db()
        .from("audit_logs")
        .select("id, actor_email, actor_role, action, entity, entity_id, diff, meta, ip, created_at", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (params.entity) q = q.eq("entity", params.entity);
      const { data, count, error } = await q;
      if (error) throw error;
      rows = (data ?? []) as AuditRow[];
      total = count ?? 0;
    } catch {
      rows = [];
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">অডিট লগ</h1>
        <p className="text-[12px] text-sand-100/45">
          কে, কখন, কী বদলেছেন — {total ? `${total.toLocaleString("bn-BD")}টি এন্ট্রি` : "এখনো কোনো এন্ট্রি নেই"}
        </p>
      </div>

      {!dbUsable() && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেসে সংযোগ নেই।
        </p>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead className="border-b border-white/[0.06] text-[10.5px] uppercase tracking-wider text-sand-100/35">
              <tr>
                <th className="px-4 py-2.5">সময়</th>
                <th className="px-4 py-2.5">ব্যক্তি</th>
                <th className="px-4 py-2.5">কাজ</th>
                <th className="px-4 py-2.5">কী বদলেছে</th>
                <th className="px-4 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((row) => {
                const changes = row.diff ? Object.keys(row.diff) : [];
                return (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-sand-100/50">
                      {formatDateBn(row.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-sand-50">{row.actor_email ?? "—"}</p>
                      <p className="text-[10.5px] text-sand-100/35">
                        {row.actor_role ? roleLabelBn(row.actor_role as UserRole) : "—"}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px]">
                        {ACTION_BN[row.action] ?? row.action}
                      </span>
                      <span className="ml-1.5 text-sand-100/45">
                        {ENTITY_BN[row.entity] ?? row.entity}
                      </span>
                      {row.entity_id && (
                        <p className="mt-0.5 font-mono text-[10px] text-sand-100/30">
                          {row.entity_id.slice(0, 8)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sand-100/55">
                      {changes.length ? (
                        <details>
                          <summary className="cursor-pointer text-[11.5px] text-leaf-300">
                            {changes.length}টি ফিল্ড
                          </summary>
                          <ul className="mt-1 space-y-0.5 font-mono text-[10.5px] text-sand-100/45">
                            {changes.map((key) => (
                              <li key={key}>
                                {key}: {JSON.stringify(row.diff![key].from)} → {JSON.stringify(row.diff![key].to)}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <span className="text-sand-100/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10.5px] text-sand-100/35">{row.ip ?? "—"}</td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[12px] text-sand-100/40">
                    কোনো লগ নেই — অ্যাডমিন কাজ শুরু করলে এখানে জমা হবে
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <nav aria-label="পৃষ্ঠা" className="flex items-center justify-center gap-2 text-[12px]">
          {Array.from({ length: Math.min(pages, 8) }, (_, i) => i + 1).map((n) => (
            <a
              key={n}
              href={`${ADMIN_BASE}/audit?${new URLSearchParams({ ...(params.entity ? { entity: params.entity } : {}), page: String(n) })}`}
              className={`min-w-[36px] rounded-lg px-2.5 py-1.5 text-center ${
                n === page ? "bg-leaf-600/25 font-semibold text-leaf-200" : "text-sand-100/50 hover:bg-white/5"
              }`}
            >
              {n}
            </a>
          ))}
        </nav>
      )}

      <p className="text-[11px] text-sand-100/35">
        অডিট লগ শুধু যোগ হয় — কেউ সম্পাদনা বা মুছে ফেলতে পারে না। পাসওয়ার্ড, টোকেন ও সিক্রেট সবসময়
        রাখা হয় <span className="font-mono">***</span> হিসেবে।
      </p>
    </div>
  );
}
