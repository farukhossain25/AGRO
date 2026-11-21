import { db, isDbConfigured } from "@/lib/db";
import { seedCoupons } from "@/lib/seed-data";
import { SimpleManager } from "@/components/admin/simple-manager";
import { formatDateBn, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  let rows: Record<string, unknown>[] = seedCoupons as unknown as Record<string, unknown>[];

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("coupons").select("*").order("created_at", { ascending: false });
      if (data?.length) rows = data;
    } catch {
      /* fall back */
    }
  }

  return (
    <SimpleManager
      title="কুপন"
      subtitle={`${rows.length}টি কুপন`}
      resource="coupons"
      initial={rows}
      dbReady={isDbConfigured()}
      emptyRow={{ code: "", type: "percent", value: 10, min_order: 0, max_discount: null, usage_limit: null, expires_at: "", is_active: true }}
      columns={[
        {
          key: "code",
          label: "কোড",
          render: (r) => (
            <span className="rounded-md bg-leaf-600/15 px-2 py-0.5 font-mono text-[11px] font-bold text-leaf-200">
              {String(r.code)}
            </span>
          ),
        },
        {
          key: "value",
          label: "ছাড়",
          render: (r) => (r.type === "percent" ? `${r.value}%` : money(Number(r.value), true)),
        },
        { key: "min_order", label: "ন্যূনতম", render: (r) => money(Number(r.min_order ?? 0), true) },
        { key: "used_count", label: "ব্যবহৃত", render: (r) => `${Number(r.used_count ?? 0)}/${r.usage_limit ?? "∞"}` },
        {
          key: "expires_at",
          label: "মেয়াদ",
          render: (r) => (r.expires_at ? formatDateBn(String(r.expires_at)) : "—"),
        },
        {
          key: "is_active",
          label: "স্টেটাস",
          render: (r) => (
            <span className={`badge !text-[9px] ${r.is_active ? "bg-leaf-600/20 text-leaf-200" : "bg-white/[0.07] text-sand-100/50"}`}>
              {r.is_active ? "সক্রিয়" : "বন্ধ"}
            </span>
          ),
        },
      ]}
      fields={[
        { name: "code", label: "কুপন কোড", type: "text", required: true, placeholder: "AGRO10" },
        {
          name: "type",
          label: "ধরন",
          type: "select",
          required: true,
          options: [
            { value: "percent", label: "শতাংশ (%)" },
            { value: "fixed", label: "নির্দিষ্ট টাকা (৳)" },
          ],
        },
        { name: "value", label: "পরিমাণ", type: "number", required: true },
        { name: "min_order", label: "ন্যূনতম অর্ডার (৳)", type: "number" },
        { name: "max_discount", label: "সর্বোচ্চ ছাড় (৳)", type: "number" },
        { name: "usage_limit", label: "ব্যবহারের সীমা", type: "number" },
        { name: "expires_at", label: "মেয়াদ শেষ", type: "date" },
        { name: "is_active", label: "সক্রিয়", type: "checkbox", hint: "কুপন চালু" },
      ]}
    />
  );
}
