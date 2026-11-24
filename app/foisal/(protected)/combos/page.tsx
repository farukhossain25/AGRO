import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

/**
 * Combo boxes (/combos on the storefront) — add, edit, reorder, switch on/off.
 * The storefront reads only `is_active` rows, in `sort_order`; `contents` is
 * the list of "name | qty" lines printed on the card. Saving also drops the
 * ISR cache of /combos, /combos/[slug] and the home page (see the generic
 * resource route), so a change shows on the next visit instead of minutes later.
 */
export default async function AdminCombosPage() {
  let rows: Record<string, unknown>[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("combos")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      rows = data ?? [];
    } catch {
      rows = [];
    }
  }

  return (
    <SimpleManager
      title="কম্বো বক্স"
      subtitle={`${rows.length}টি কম্বো · স্টোরফ্রন্টের /combos পেজে সক্রিয়গুলো দেখায়`}
      resource="combos"
      initial={rows}
      dbReady={isDbConfigured()}
      emptyRow={{
        name_bn: "",
        name_en: "",
        slug: "",
        kind: "daily",
        description_bn: "",
        price: 0,
        original_price: null,
        contents: [],
        image: "",
        is_active: true,
        sort_order: 0,
      }}
      columns={[
        { key: "image", label: "ছবি", format: "thumb" },
        { key: "name_bn", label: "কম্বো", format: "stack", subKey: "slug" },
        { key: "kind", label: "ধরন", format: "text", map: { daily: "ডেইলি", weekly: "উইকলি", monthly: "মাসিক" }, nowrap: true },
        { key: "price", label: "দাম", format: "money", nowrap: true },
        { key: "original_price", label: "আসল দাম", format: "money", nowrap: true },
        { key: "contents", label: "আইটেম", format: "count", nowrap: true },
        { key: "sort_order", label: "ক্রম", format: "number", nowrap: true },
        { key: "is_active", label: "স্টেটাস", format: "badge", trueLabel: "সক্রিয়", falseLabel: "বন্ধ", nowrap: true },
        { key: "slug", label: "স্টোরফ্রন্ট", format: "link", linkPath: "/combos/{v}", linkLabel: "দেখুন", nowrap: true },
      ]}
      fields={[
        { name: "name_bn", label: "কম্বোর নাম (বাংলা)", type: "text", required: true, placeholder: "সাপ্তাহিক পারিবারিক বক্স" },
        { name: "name_en", label: "নাম (ইংরেজি)", type: "text", placeholder: "Weekly Family Box", hint: "slug খালি থাকলে এই নাম থেকে তৈরি হবে" },
        { name: "slug", label: "slug", type: "text", placeholder: "weekly-family-box", hint: "/combos/<slug> — খালি রাখলে অটো" },
        {
          name: "kind",
          label: "ধরন",
          type: "select",
          required: true,
          options: [
            { value: "daily", label: "ডেইলি কম্বো" },
            { value: "weekly", label: "উইকলি কম্বো" },
            { value: "monthly", label: "মাসিক কম্বো" },
          ],
        },
        { name: "price", label: "কম্বো দাম (৳)", type: "number", required: true },
        { name: "original_price", label: "আসল দাম (৳)", type: "number", hint: "দিলে কার্ডে “কত % সাশ্রয়” দেখায়" },
        {
          name: "contents",
          label: "বক্সে যা থাকবে",
          type: "lines",
          colSpan: 2,
          required: true,
          placeholder: "আটা | ২ কেজি\\nসবজি | ৩ কেজি\\nডিম | ১২ পিস",
          hint: "প্রতি লাইনে একটি আইটেম: পণ্যের নাম | পরিমাণ। পরিমাণ না দিলে “১টি” ধরা হবে।",
        },
        { name: "description_bn", label: "বিবরণ", type: "textarea", colSpan: 2, placeholder: "এক সপ্তাহের জন্য হালকা করা বাজার…" },
        { name: "image", label: "ছবি", type: "image", colSpan: 2, hint: "কার্ডে ১৬:১০ অনুপাতে দেখায় — লম্বালেজি ছবি ভালো" },
        { name: "sort_order", label: "ক্রম", type: "number", hint: "ছোট সংখ্যা আগে" },
        { name: "is_active", label: "সক্রিয়", type: "checkbox", hint: "স্টোরফ্রন্টে দেখাবে" },
      ]}
    />
  );
}
