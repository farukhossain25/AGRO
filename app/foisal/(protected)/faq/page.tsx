import { db, dbUsable } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "FAQ ম্যানেজার", robots: { index: false, follow: false } };

/* The accordion on /faq comes from `faq_items` (migration 0007). Editing a
   question here changes the public page within its 5-minute revalidate window,
   and the FAQPage JSON-LD follows automatically because it is generated from
   the same rows. */
export default async function AdminFaqPage() {
  let rows: Record<string, unknown>[] = [];

  if (dbUsable()) {
    try {
      const { data } = await db()
        .from("faq_items")
        .select("*")
        .order("group_bn")
        .order("sort_order");
      rows = data ?? [];
    } catch {
      rows = [];
    }
  }

  return (
    <SimpleManager
      title="প্রশ্ন ও উত্তর"
      subtitle="/faq পেজের অ্যাকর্ডিয়ন — গ্রুপ অনুযায়ী সাজানো"
      resource="faq"
      initial={rows}
      dbReady={dbUsable()}
      emptyRow={{ group_bn: "সাধারণ", question_bn: "", answer_bn: "", sort_order: 0, is_active: true }}
      columns={[
        { key: "question_bn", label: "প্রশ্ন", format: "stack", subKey: "answer_bn" },
        { key: "group_bn", label: "গ্রুপ" },
        { key: "sort_order", label: "ক্রম", format: "number" },
        { key: "is_active", label: "স্টেটাস", format: "badge", trueLabel: "দৃশ্যমান", falseLabel: "লুকানো" },
      ]}
      fields={[
        {
          name: "group_bn",
          label: "গ্রুপ",
          type: "text",
          required: true,
          hint: "যেমন: অর্ডার ও ডেলিভারি, পেমেন্ট, গুণমান ও রিটার্ন — একই নাম দিলে একসাথে দেখাবে",
        },
        { name: "question_bn", label: "প্রশ্ন", type: "text", required: true, colSpan: 2 },
        { name: "answer_bn", label: "উত্তর", type: "textarea", required: true, colSpan: 2 },
        { name: "sort_order", label: "ক্রম", type: "number" },
        { name: "is_active", label: "সাইটে দেখাবে", type: "checkbox" },
      ]}
    />
  );
}
