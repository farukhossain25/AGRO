import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  let rows: Record<string, unknown>[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("coupons").select("*").order("created_at", { ascending: false });
      rows = data ?? [];
    } catch {
      rows = [];
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
        { key: "code", label: "কোড", format: "code" },
        { key: "value", label: "ছাড়", format: "coupon_value" },
        { key: "min_order", label: "ন্যূনতম", format: "money" },
        { key: "usage_limit", label: "ব্যবহৃত", format: "usage" },
        { key: "expires_at", label: "মেয়াদ", format: "date" },
        { key: "is_active", label: "স্টেটাস", format: "badge", trueLabel: "সক্রিয়", falseLabel: "বন্ধ" },
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
