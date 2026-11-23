import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage() {
  let rows: Record<string, unknown>[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("delivery_charges").select("*").order("district");
      rows = data ?? [];
    } catch {
      rows = [];
    }
  }

  return (
    <SimpleManager
      title="ডেলিভারি চার্জ"
      subtitle="ঢাকার ভেতরে ৳৬০, বাইরে ৳১২০ — ৳১২০০+ অর্ডারে ফ্রি"
      resource="delivery"
      initial={rows}
      dbReady={isDbConfigured()}
      emptyRow={{ district: "", division: "ঢাকা", scope: "outside_dhaka", charge: 120, free_over: 1200, eta_days: "২-৩ দিন", is_active: true }}
      columns={[
        { key: "district", label: "জেলা" },
        { key: "division", label: "বিভাগ" },
        { key: "scope", label: "এলাকা", format: "scope" },
        { key: "charge", label: "চার্জ", format: "money" },
        { key: "free_over", label: "ফ্রি (৳+)", format: "money" },
        { key: "eta_days", label: "সময়" },
      ]}
      fields={[
        { name: "district", label: "জেলা", type: "text", required: true },
        { name: "division", label: "বিভাগ", type: "text", required: true },
        {
          name: "scope",
          label: "এলাকা",
          type: "select",
          required: true,
          options: [
            { value: "inside_dhaka", label: "ঢাকার ভেতরে" },
            { value: "outside_dhaka", label: "ঢাকার বাইরে" },
          ],
        },
        { name: "charge", label: "ডেলিভারি চার্জ (৳)", type: "number", required: true },
        { name: "free_over", label: "ফ্রি ডেলিভারি (৳ এর বেশি)", type: "number" },
        { name: "eta_days", label: "ডেলিভারি সময়", type: "text", placeholder: "২-৩ দিন" },
        { name: "is_active", label: "সক্রিয়", type: "checkbox", hint: "জোনটি ব্যবহার হবে" },
      ]}
    />
  );
}
