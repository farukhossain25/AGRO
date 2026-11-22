import { db, dbUsable } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "সাইড পেজ (CMS)", robots: { index: false, follow: false } };

/* Legal / about style pages (table `cms_pages`, migration 0007). The body is a
   JSONB block list, so the textarea holds JSON — the field hint spells out the
   five block types the renderer accepts. Anything else is dropped on render,
   which means a typo in here can only lose a block, never break the page. */
export default async function AdminCmsPage() {
  let rows: Record<string, unknown>[] = [];

  if (dbUsable()) {
    try {
      const { data } = await db().from("cms_pages").select("*").order("sort_order");
      rows = (data ?? []).map((row) => ({
        ...row,
        blocks: JSON.stringify(row.blocks ?? [], null, 1),
      }));
    } catch {
      rows = [];
    }
  }

  return (
    <SimpleManager
      title="সাইড পেজ"
      subtitle="প্রাইভেসি / শর্তাবলি / রিফান্ড — ব্লক আকারে সম্পাদনা করুন"
      resource="cms-pages"
      initial={rows}
      dbReady={dbUsable()}
      emptyRow={{
        slug: "",
        title_bn: "",
        title_en: "",
        blocks: "[]",
        seo_title: "",
        seo_description: "",
        is_published: true,
        show_in_footer: true,
        sort_order: 0,
      }}
      columns={[
        { key: "title_bn", label: "শিরোনাম", format: "stack", subKey: "slug", subPrefix: "/policies/" },
        { key: "sort_order", label: "ক্রম", format: "number" },
        { key: "is_published", label: "স্টেটাস", format: "badge", trueLabel: "প্রকাশিত", falseLabel: "লুকানো" },
      ]}
      fields={[
        { name: "title_bn", label: "শিরোনাম (বাংলা)", type: "text", required: true },
        {
          name: "slug",
          label: "Slug",
          type: "text",
          required: true,
          placeholder: "privacy",
          hint: "URL হবে /policies/<slug>",
        },
        { name: "title_en", label: "শিরোনাম (English)", type: "text" },
        {
          name: "blocks",
          label: "বিষয়বস্তু (JSON ব্লক)",
          type: "textarea",
          colSpan: 2,
          hint: 'অনুমোদিত: {"type":"heading","text":"…"} · {"type":"text","body":"…"} · {"type":"list","items":["…"]} · {"type":"callout","tone":"info","body":"…"} · {"type":"image","src":"/images/…","alt":"…"}',
        },
        { name: "seo_title", label: "SEO টাইটেল", type: "text" },
        { name: "seo_description", label: "SEO ডেসক্রিপশন", type: "text" },
        { name: "sort_order", label: "ক্রম", type: "number" },
        { name: "is_published", label: "প্রকাশিত", type: "checkbox" },
        { name: "show_in_footer", label: "ফুটারে দেখাবে", type: "checkbox" },
      ]}
    />
  );
}
