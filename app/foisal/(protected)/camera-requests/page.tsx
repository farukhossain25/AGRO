import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";
import { toBn } from "@/lib/format";

export const dynamic = "force-dynamic";

/* Exactly the values camera_requests.status allows in the database
   (check constraint in 03_catalog_tables.sql). The panel used to offer
   `approved` / `rejected`, which Postgres rejected — so the "approve" click
   silently failed and the request stayed pending. */
const STATUS_OPTIONS = [
  { value: "pending", label: "অপেক্ষমাণ" },
  { value: "contacted", label: "যোগাযোগ করা হয়েছে" },
  { value: "scheduled", label: "অনুমোদিত — ইনস্টলের দিন নির্ধারিত" },
  { value: "installed", label: "ইনস্টল সম্পন্ন (ক্যামেরা লাইভ)" },
  { value: "cancelled", label: "বাতিল" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  contacted: "যোগাযোগ করা হয়েছে",
  scheduled: "অনুমোদিত — ইনস্টলের দিন নির্ধারিত",
  installed: "ইনস্টল সম্পন্ন (ক্যামেরা লাইভ)",
  cancelled: "বাতিল",
  // legacy rows
  approved: "অনুমোদিত",
  rejected: "বাতিল",
};

type Joined = {
  id: string;
  status: string;
  camera_count: number;
  seller_id: string | null;
  farm_id: string | null;
  sellers?: { name_bn: string; slug: string } | null;
  farms?: { name_bn: string; slug: string } | null;
};

export default async function AdminCameraRequestsPage() {
  let rows: Record<string, unknown>[] = [];
  let dbReady = isDbConfigured();

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("camera_requests")
        .select("*, sellers(name_bn, slug), farms(name_bn, slug)")
        .order("created_at", { ascending: false });

      // Flatten the joins for the table; the API whitelist keeps these
      // display keys out of the PATCH.
      rows = ((data ?? []) as unknown as Joined[]).map((r) => ({
        ...r,
        status_label: STATUS_LABEL[r.status] ?? r.status,
        seller_name: r.sellers?.name_bn ?? "—",
        farm_name: r.farms?.name_bn ?? "খামার যুক্ত নেই",
        live_url: r.farms?.slug ? `/live/farms/${r.farms.slug}` : "",
      }));
    } catch {
      dbReady = false;
    }
  }

  const pending = rows.filter((r) => r.status === "pending").length;
  const installed = rows.filter((r) => r.status === "installed").length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-leaf-600/25 bg-leaf-600/8 p-3.5 text-[11.5px] leading-relaxed text-leaf-100/80">
        <strong>স্টেটাস &rarr; &ldquo;ইনস্টল সম্পন্ন&rdquo; করলে</strong> রিকোয়েস্টের ক্যামেরা সংখ্যা অনুযায়ী সেলারের
        খামারে ক্যামেরা স্বয়ংক্রিয়ভাবে তৈরি হয় (MediaMTX stream key সহ) এবং লাইভ পৃষ্ঠায় দেখা যায়। সেলারের
        খামার না থাকলে সেটিও তৈরি হয়। এরপর &ldquo;ক্যামেরা&rdquo; স্ক্রিনে গিয়ে ক্যামেরার নাম/জোন/স্টেটাস ঠিক করা যায়।
      </div>

      <SimpleManager
        title="ক্যামেরা রিকোয়েস্ট"
        subtitle={`${toBn(rows.length)}টি রিকোয়েস্ট · ${toBn(pending)}টি অপেক্ষমাণ · ${toBn(installed)}টি ইনস্টল সম্পন্ন`}
        resource="camera-requests"
        initial={rows}
        dbReady={dbReady}
        emptyRow={{ camera_count: 1, note_bn: "", status: "pending" }}
        columns={[
          { key: "note_bn", label: "বিবরণ", format: "stack", subKey: "admin_note", subPrefix: "অ্যাডমিন: " },
          { key: "seller_name", label: "সেলার" },
          { key: "farm_name", label: "খামার" },
          { key: "camera_count", label: "ক্যামেরা", format: "number", nowrap: true },
          { key: "status_label", label: "স্টেটাস", nowrap: true },
          { key: "live_url", label: "লাইভ পৃষ্ঠা", format: "link", linkLabel: "দেখুন ↗", nowrap: true },
          { key: "created_at", label: "তারিখ", format: "date", nowrap: true },
        ]}
        fields={[
          {
            name: "status",
            label: "স্টেটাস",
            type: "select",
            options: STATUS_OPTIONS,
            required: true,
            colSpan: 2,
            hint: "ইনস্টল সম্পন্ন করলে ক্যামেরা স্বয়ংক্রিয়ভাবে তৈরি হবে",
          },
          { name: "camera_count", label: "ক্যামেরা সংখ্যা", type: "number" },
          { name: "note_bn", label: "সেলারের নোট", type: "textarea", colSpan: 2 },
          { name: "admin_note", label: "অ্যাডমিন নোট", type: "textarea", colSpan: 2 },
        ]}
      />
    </div>
  );
}
