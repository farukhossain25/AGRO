import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

/* ==========================================================================
   মাসিক ফুড সাবস্ক্রিপশন — the plans the /subscription page sells
   --------------------------------------------------------------------------
   These are `subscription_plans` rows (৪-৫ জন / ৬-৮ জন …), not the premium
   camera plans on /foisal/plans and not a customer's running subscription on
   /foisal/subscriptions. Until this screen existed the owner could only seed
   them through SQL 11, so changing a monthly price or a feature list needed a
   developer. Add / edit / remove now all live here, and the storefront pages
   that print them are revalidated on every save.
   ========================================================================== */

export default async function AdminFoodPlansPage() {
  let rows: Record<string, unknown>[] = [];
  let activeSubs = 0;
  let dbReady = isDbConfigured();

  if (isDbConfigured()) {
    try {
      const [{ data }, { count }] = await Promise.all([
        db().from("subscription_plans").select("*").order("sort_order"),
        db()
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
      ]);
      rows = (data ?? []) as Record<string, unknown>[];
      activeSubs = count ?? 0;
    } catch {
      dbReady = false;
    }
  }

  return (
    <SimpleManager
      title="মাসিক ফুড সাবস্ক্রিপশন"
      subtitle={`${rows.length}টি প্ল্যান · ${activeSubs}টি চালু সাবস্ক্রিপশন · ওয়েবসাইটের /subscription পেজ এখান থেকেই বদলাবে`}
      resource="subscription-plans"
      initial={rows}
      dbReady={dbReady}
      emptyRow={{
        slug: "",
        name_bn: "",
        name_en: "",
        members_label: "৪-৫ জন",
        members_min: 4,
        members_max: 5,
        price_monthly: 0,
        saving_label: "",
        features: [],
        image: "",
        is_popular: false,
        is_active: true,
        sort_order: 99,
      }}
      columns={[
        { key: "name_bn", label: "প্ল্যান", format: "stack", subKey: "slug" },
        { key: "members_label", label: "সদস্য" },
        { key: "price_monthly", label: "মাসিক দাম", format: "money" },
        { key: "features", label: "ফিচার", format: "count" },
        { key: "is_popular", label: "জনপ্রিয়", format: "badge", trueLabel: "হ্যাঁ", falseLabel: "না" },
        { key: "is_active", label: "সক্রিয়", format: "badge", trueLabel: "হ্যাঁ", falseLabel: "না" },
      ]}
      fields={[
        { name: "name_bn", label: "বাংলা নাম", type: "text", required: true, colSpan: 2, placeholder: "যেমন: ফ্যামিলি বক্স" },
        { name: "name_en", label: "English name", type: "text" },
        { name: "slug", label: "Slug", type: "text", hint: "খালি রাখলে নাম থেকে নিজে তৈরি হবে" },
        {
          name: "members",
          label: "কতজনের জন্য",
          type: "members",
          colSpan: 2,
          hint: "কাস্টমার এই লেখাটি দেখবে (যেমন “৪-৫ জন”)। সংখ্যা বদলালে লেখাটি নিজেই বদলে যাবে।",
        },
        { name: "price_monthly", label: "মাসিক দাম (৳)", type: "number", required: true },
        { name: "saving_label", label: "সাশ্রয়ের লেখা", type: "text", hint: "যেমন: “মাসে ৳৪০০ সাশ্রয়”" },
        {
          name: "features",
          label: "ফিচার — প্রতি লাইনে একটি",
          type: "array",
          colSpan: 2,
          placeholder: "সপ্তাহে ৩ কেজি সবজি\nমাসে ২ বার দেশি মুরগি\nডেলিভারি ফ্রি",
        },
        { name: "image", label: "ছবি URL", type: "text", colSpan: 2, hint: "নিজের আপলোড করা ছবির লিংক" },
        { name: "sort_order", label: "ক্রম", type: "number", hint: "ছোট সংখ্যা আগে" },
        { name: "is_popular", label: "জনপ্রিয়", type: "checkbox" },
        { name: "is_active", label: "সক্রিয়", type: "checkbox" },
      ]}
    />
  );
}
