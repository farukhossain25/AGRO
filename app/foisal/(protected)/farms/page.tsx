import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

const TYPE_OPTIONS = [
  { value: "vegetables", label: "শাকসবজি" },
  { value: "dairy", label: "দুগ্ধ" },
  { value: "poultry", label: "মুরগি ও ডিম" },
  { value: "fish", label: "মাছ" },
  { value: "fruits", label: "ফল" },
];

export default async function AdminFarmsPage() {
  // An empty table plus `dbReady: false` is the offline state: the UI shows a
  // friendly empty panel and disables writes instead of inventing seed rows.
  let rows: Record<string, unknown>[] = [];
  let cameras = 0;
  let dbReady = isDbConfigured();

  if (isDbConfigured()) {
    try {
      const [{ data }, { count }] = await Promise.all([
        db().from("farms").select("*").order("sort_order"),
        db().from("cameras").select("id", { count: "exact", head: true }),
      ]);
      rows = (data ?? []) as Record<string, unknown>[];
      cameras = count ?? 0;
    } catch {
      dbReady = false;
    }
  }

  return (
    <SimpleManager
      title="খামার"
      subtitle={`${rows.length}টি খামার · ${cameras}টি ক্যামেরা`}
      resource="farms"
      initial={rows}
      dbReady={dbReady}
      emptyRow={{
        slug: "",
        name_bn: "",
        name_en: "",
        type: "vegetables",
        owner_name_bn: "",
        owner_phone: "",
        division: "ঢাকা",
        district: "ঢাকা",
        upazila: "",
        address_bn: "",
        lat: 23.81,
        lng: 90.41,
        description_bn: "",
        cover: "",
        is_active: true,
        is_premium: true,
        sort_order: 99,
      }}
      columns={[
        { key: "name_bn", label: "খামার", format: "stack", subKey: "district" },
        { key: "type", label: "ধরন" },
        { key: "owner_name_bn", label: "খামারি", format: "text" },
        { key: "owner_phone", label: "ফোন", format: "text" },
        { key: "established_year", label: "শুরু", format: "number" },
        { key: "is_active", label: "স্টেটাস", format: "badge", trueLabel: "সক্রিয়", falseLabel: "বন্ধ" },
      ]}
      fields={[
        { name: "name_bn", label: "বাংলা নাম", type: "text", required: true, colSpan: 2 },
        { name: "name_en", label: "English name", type: "text" },
        { name: "slug", label: "Slug", type: "text", required: true, hint: "ইংরেজি, হাইফেন" },
        { name: "type", label: "ধরন", type: "select", options: TYPE_OPTIONS },
        { name: "owner_name_bn", label: "খামারির নাম", type: "text" },
        { name: "owner_phone", label: "খামারির ফোন", type: "text" },
        { name: "division", label: "বিভাগ", type: "text" },
        { name: "district", label: "জেলা", type: "text" },
        { name: "upazila", label: "উপজেলা", type: "text" },
        { name: "address_bn", label: "ঠিকানা", type: "text", colSpan: 2 },
        { name: "lat", label: "Latitude", type: "number" },
        { name: "lng", label: "Longitude", type: "number" },
        { name: "cover", label: "কভার ছবি URL", type: "text", colSpan: 2 },
        { name: "description_bn", label: "বিবরণ", type: "textarea", colSpan: 2 },
        { name: "established_year", label: "প্রতিষ্ঠা সাল", type: "number" },
        { name: "sort_order", label: "ক্রম", type: "number" },
        { name: "is_active", label: "সক্রিয়", type: "checkbox" },
        { name: "is_premium", label: "প্রিমিয়াম খামার", type: "checkbox" },
      ]}
    />
  );
}
