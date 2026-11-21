import { db, isDbConfigured } from "@/lib/db";
import { getCategories } from "@/lib/data";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const cats = await getCategories(false);
  let rows: Record<string, unknown>[] = cats as unknown as Record<string, unknown>[];

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("categories").select("*").order("sort_order");
      if (data?.length) rows = data;
    } catch {
      /* fall back */
    }
  }

  return (
    <SimpleManager
      title="ক্যাটাগরি"
      subtitle={`${rows.length}টি ক্যাটাগরি`}
      resource="categories"
      initial={rows}
      dbReady={isDbConfigured()}
      emptyRow={{ slug: "", name_bn: "", name_en: "", description_bn: "", icon: "🌿", sort_order: 0, is_active: true }}
      columns={[
        { key: "icon", label: "আইকন", render: (r) => <span className="text-lg">{String(r.icon ?? "🌿")}</span> },
        {
          key: "name_bn",
          label: "নাম",
          render: (r) => (
            <div>
              <p className="font-medium">{String(r.name_bn)}</p>
              <p className="text-[9.5px] text-sand-100/35">{String(r.slug)}</p>
            </div>
          ),
        },
        { key: "name_en", label: "English" },
        { key: "sort_order", label: "ক্রম" },
        {
          key: "is_active",
          label: "স্টেটাস",
          render: (r) => (
            <span className={`badge !text-[9px] ${r.is_active ? "bg-leaf-600/20 text-leaf-200" : "bg-white/[0.07] text-sand-100/50"}`}>
              {r.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
            </span>
          ),
        },
      ]}
      fields={[
        { name: "name_bn", label: "বাংলা নাম", type: "text", required: true },
        { name: "name_en", label: "English name", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true, placeholder: "vegetables" },
        { name: "icon", label: "আইকন (ইমোজি)", type: "text", placeholder: "🥬" },
        { name: "description_bn", label: "বিবরণ", type: "textarea", colSpan: 2 },
        { name: "sort_order", label: "ক্রম", type: "number" },
        { name: "is_active", label: "সক্রিয়", type: "checkbox", hint: "সাইটে দেখাবে" },
      ]}
    />
  );
}
