import { db, dbUsable } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "SEO ম্যানেজার", robots: { index: false, follow: false } };

/* Per-route title/description/OG overrides (table `seo_meta`, migration 0006).
   The same 10 routes the sitemap and JSON-LD already cover are pre-seeded, so
   this opens with real copy instead of a blank form; anything left blank falls
   back to the built-in metadata in code. */
export default async function AdminSeoPage() {
  let rows: Record<string, unknown>[] = [];

  if (dbUsable()) {
    try {
      const { data } = await db().from("seo_meta").select("*").order("path");
      rows = data ?? [];
    } catch {
      rows = [];
    }
  }

  return (
    <SimpleManager
      title="SEO ম্যানেজার"
      subtitle="প্রতিটি পেজের টাইটেল, ডেসক্রিপশন ও OG ট্যাগ — ডিপ্লয় ছাড়াই বদলান"
      resource="seo"
      initial={rows}
      dbReady={dbUsable()}
      emptyRow={{
        path: "/",
        title_bn: "",
        description_bn: "",
        keywords_bn: [],
        og_title: "",
        og_description: "",
        og_image: "",
        canonical: "",
        noindex: false,
      }}
      columns={[
        { key: "path", label: "রুট", format: "code" },
        { key: "title_bn", label: "টাইটেল", format: "stack", subKey: "description_bn" },
        { key: "noindex", label: "নোইনডেক্স", format: "badge" },
      ]}
      fields={[
        {
          name: "path",
          label: "রুট",
          type: "text",
          required: true,
          placeholder: "/products",
          hint: "স্ল্যাশ দিয়ে শুরু, ওয়াইল্ডকার্ড নেই — /blog, /products, /live/farms",
        },
        { name: "title_bn", label: "টাইটেল (বাংলা)", type: "text", colSpan: 2, hint: "৫০–৬০ অক্ষর ভালো" },
        {
          name: "description_bn",
          label: "ডেসক্রিপশন (বাংলা)",
          type: "textarea",
          colSpan: 2,
          hint: "১৫০–১৬০ অক্ষর; খালি রাখলে কোডের ডিফল্ট থাকবে",
        },
        {
          name: "keywords_bn",
          label: "কীওয়ার্ড",
          type: "text",
          colSpan: 2,
          hint: "কমা দিয়ে আলাদা করুন",
        },
        { name: "og_title", label: "OG টাইটেল", type: "text" },
        { name: "og_image", label: "OG ছবি", type: "text", placeholder: "/images/cat/vegetables.jpg" },
        { name: "og_description", label: "OG ডেসক্রিপশন", type: "textarea", colSpan: 2 },
        {
          name: "noindex",
          label: "সার্চে দেখাবে না",
          type: "checkbox",
          hint: "শুধু প্রয়োজন হলে — প্রাইভেট পেজ ইতিমধ্যে ব্লক করা আছে",
        },
      ]}
    />
  );
}
