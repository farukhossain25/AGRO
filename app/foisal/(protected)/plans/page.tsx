import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  let rows: Record<string, unknown>[] = [];
  let dbReady = isDbConfigured();

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("plans").select("*").order("sort_order");
      rows = (data ?? []) as Record<string, unknown>[];
    } catch {
      dbReady = false;
    }
  }

  return (
    <SimpleManager
      title="প্রিমিয়াম প্ল্যান"
      subtitle={`${rows.length}টি প্ল্যান · দাম ও ফিচার এখান থেকেই বদলাবে`}
      resource="premium-plans"
      initial={rows}
      dbReady={dbReady}
      emptyRow={{
        slug: "",
        name_bn: "",
        name_en: "",
        tier: "full",
        interval: "monthly",
        price: 299,
        compare_price: null,
        duration_days: 30,
        max_devices: 2,
        features: [],
        is_active: true,
        is_popular: false,
        sort_order: 99,
      }}
      columns={[
        { key: "name_bn", label: "প্ল্যান", format: "stack", subKey: "slug" },
        { key: "tier", label: "টিয়ার" },
        { key: "interval", label: "ইন্টারভাল" },
        { key: "price", label: "দাম", format: "money" },
        { key: "duration_days", label: "দিন", format: "number" },
        { key: "max_devices", label: "ডিভাইস", format: "number" },
        { key: "is_popular", label: "জনপ্রিয়", format: "badge", trueLabel: "হ্যাঁ", falseLabel: "না" },
        { key: "is_active", label: "সক্রিয়", format: "badge", trueLabel: "হ্যাঁ", falseLabel: "না" },
      ]}
      fields={[
        { name: "name_bn", label: "বাংলা নাম", type: "text", required: true, colSpan: 2 },
        { name: "name_en", label: "English name", type: "text" },
        { name: "slug", label: "Slug", type: "text", required: true },
        {
          name: "tier",
          label: "টিয়ার",
          type: "select",
          options: [
            { value: "basic", label: "বেসিক" },
            { value: "full", label: "ফুল অ্যাক্সেস" },
          ],
        },
        {
          name: "interval",
          label: "ইন্টারভাল",
          type: "select",
          options: [
            { value: "monthly", label: "মাসিক" },
            { value: "half_yearly", label: "ষান্মাসিক" },
            { value: "yearly", label: "বাৎসরিক" },
          ],
        },
        { name: "price", label: "দাম (৳)", type: "number", required: true },
        { name: "compare_price", label: "আগের দাম", type: "number" },
        { name: "duration_days", label: "মেয়াদ (দিন)", type: "number", required: true },
        { name: "max_devices", label: "ডিভাইস সংখ্যা", type: "number" },
        { name: "sort_order", label: "ক্রম", type: "number" },
        { name: "is_popular", label: "জনপ্রিয়", type: "checkbox" },
        { name: "is_active", label: "সক্রিয়", type: "checkbox" },
      ]}
    />
  );
}
