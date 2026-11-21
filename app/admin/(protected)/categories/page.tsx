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
        { key: "icon", label: "আইকন", format: "icon" },
        { key: "name_bn", label: "নাম", format: "stack", subKey: "slug" },
        { key: "name_en", label: "English" },
        { key: "sort_order", label: "ক্রম", format: "number" },
        { key: "is_active", label: "স্টেটাস", format: "badge" },
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
