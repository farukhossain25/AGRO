import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export default async function AdminCameraRequestsPage() {
  let rows: Record<string, unknown>[] = [];
  let dbReady = isDbConfigured();

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("camera_requests")
        .select("*")
        .order("created_at", { ascending: false });
      rows = (data ?? []) as Record<string, unknown>[];
    } catch {
      dbReady = false;
    }
  }

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <SimpleManager
      title="ক্যামেরা রিকোয়েস্ট"
      subtitle={`${rows.length}টি রিকোয়েস্ট · ${pending}টি অপেক্ষমাণ`}
      resource="camera-requests"
      initial={rows}
      dbReady={dbReady}
      emptyRow={{ camera_count: 1, note_bn: "", status: "pending" }}
      columns={[
        { key: "note_bn", label: "বিবরণ", format: "text" },
        { key: "camera_count", label: "ক্যামেরা", format: "number" },
        { key: "status", label: "স্টেটাস" },
        { key: "admin_note", label: "অ্যাডমিন নোট" },
        { key: "created_at", label: "তারিখ", format: "date" },
      ]}
      fields={[
        { name: "camera_count", label: "ক্যামেরা সংখ্যা", type: "number" },
        {
          name: "status",
          label: "স্টেটাস",
          type: "select",
          options: [
            { value: "pending", label: "অপেক্ষমাণ" },
            { value: "approved", label: "অনুমোদিত" },
            { value: "rejected", label: "বাতিল" },
            { value: "installed", label: "ইনস্টল সম্পন্ন" },
          ],
        },
        { name: "note_bn", label: "সেলারের নোট", type: "textarea", colSpan: 2 },
        { name: "admin_note", label: "অ্যাডমিন নোট", type: "textarea", colSpan: 2 },
      ]}
    />
  );
}
