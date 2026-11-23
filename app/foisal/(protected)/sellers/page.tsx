import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export default async function AdminSellersPage() {
  const decorate = (list: Record<string, unknown>[]) =>
    list.map((s) => ({
      ...s,
      contact: s.email ? `${s.phone} · ${s.email}` : s.phone,
    }));

  let rows: Record<string, unknown>[] = [];
  let dbReady = isDbConfigured();

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("sellers").select("*").order("created_at", { ascending: false });
      rows = decorate((data ?? []) as Record<string, unknown>[]);
    } catch {
      dbReady = false;
    }
  }

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
  };

  return (
    <SimpleManager
      title="সেলার"
      subtitle={`${rows.length}টি স্টোর · ${counts.approved}টি অনুমোদিত · ${counts.pending}টি অপেক্ষমাণ`}
      resource="sellers"
      initial={rows}
      dbReady={dbReady}
      emptyRow={{
        name_bn: "",
        slug: "",
        phone: "",
        email: "",
        division: "ঢাকা",
        district: "ঢাকা",
        farm_address_bn: "",
        payout_method: "bkash",
        payout_number: "",
        commission_percent: 10,
        status: "pending",
      }}
      columns={[
        { key: "name_bn", label: "স্টোর", format: "stack", subKey: "slug" },
        { key: "contact", label: "যোগাযোগ" },
        { key: "district", label: "জেলা" },
        { key: "commission_percent", label: "কমিশন %", format: "number" },
        { key: "status", label: "স্টেটাস" },
        { key: "payout_method", label: "পেমেন্ট" },
      ]}
      fields={[
        { name: "name_bn", label: "স্টোরের নাম", type: "text", required: true, colSpan: 2 },
        { name: "slug", label: "Slug", type: "text", required: true, hint: "পাবলিক URL: /market/<slug>" },
        {
          name: "status",
          label: "স্টেটাস",
          type: "select",
          options: [
            { value: "pending", label: "যাচাই চলছে" },
            { value: "approved", label: "অনুমোদিত" },
            { value: "rejected", label: "বাতিল" },
            { value: "suspended", label: "স্থগিত" },
          ],
        },
        { name: "phone", label: "মোবাইল", type: "text", required: true },
        { name: "email", label: "ইমেইল", type: "text" },
        { name: "nid", label: "NID", type: "text" },
        { name: "division", label: "বিভাগ", type: "text" },
        { name: "district", label: "জেলা", type: "text" },
        { name: "farm_address_bn", label: "খামারের ঠিকানা", type: "textarea", colSpan: 2 },
        { name: "commission_percent", label: "কমিশন %", type: "number" },
        {
          name: "payout_method",
          label: "পেমেন্ট মাধ্যম",
          type: "select",
          options: [
            { value: "bkash", label: "bKash" },
            { value: "nagad", label: "Nagad" },
            { value: "bank", label: "ব্যাংক" },
          ],
        },
        { name: "payout_number", label: "পেমেন্ট নম্বর", type: "text" },
        { name: "bank_name", label: "ব্যাংকের নাম", type: "text" },
        { name: "bank_account", label: "হিসাব নম্বর", type: "text" },
        { name: "rejection_reason", label: "বাতিলের কারণ", type: "textarea", colSpan: 2 },
      ]}
    />
  );
}
