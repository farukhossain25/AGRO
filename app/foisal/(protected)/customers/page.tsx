import { db, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  phone_verified: boolean;
  created_at: string;
};

export default async function AdminCustomersPage() {
  let customers: Row[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("users")
        .select("id, name, email, phone, role, phone_verified, created_at")
        .eq("role", "customer")
        .order("created_at", { ascending: false })
        .limit(500);
      customers = (data ?? []) as Row[];
    } catch {
      customers = [];
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">কাস্টমার</h1>
        <p className="text-[12px] text-sand-100/45">{customers.length} জন নিবন্ধিত গ্রাহক</p>
      </div>

      {!isDbConfigured() ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেস সংযুক্ত নেই — কাস্টমার তালিকা লোড হয়নি।
        </p>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-sand-100/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">নাম</th>
                <th className="px-2 py-2.5 font-medium">ফোন</th>
                <th className="px-2 py-2.5 font-medium">ইমেইল</th>
                <th className="px-2 py-2.5 font-medium">ভেরিফায়েড</th>
                <th className="px-3 py-2.5 font-medium">যোগদান</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-medium">{c.name ?? "—"}</td>
                  <td className="px-2 py-2.5 font-mono text-[11px]">{c.phone ?? "—"}</td>
                  <td className="px-2 py-2.5 text-[11px] text-sand-100/60">{c.email ?? "—"}</td>
                  <td className="px-2 py-2.5">
                    <span className={`badge !text-[9px] ${c.phone_verified ? "bg-leaf-600/20 text-leaf-200" : "bg-white/[0.07] text-sand-100/45"}`}>
                      {c.phone_verified ? "হ্যাঁ" : "না"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-sand-100/50">
                    {new Date(c.created_at).toLocaleDateString("bn-BD")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!customers.length ? (
          <p className="py-10 text-center text-[12px] text-sand-100/40">এখনো কোনো কাস্টমার নিবন্ধন করেনি</p>
        ) : null}
      </div>
    </div>
  );
}
