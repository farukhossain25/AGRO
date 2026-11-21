import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  let rows: Record<string, unknown>[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("banners").select("*").order("sort_order");
      rows = data ?? [];
    } catch {
      rows = [];
    }
  }

  return (
    <SimpleManager
      title="ব্যানার"
      subtitle="হোমপেজ ও ক্যাম্পেইন ব্যানার"
      resource="banners"
      initial={rows}
      dbReady={isDbConfigured()}
      emptyRow={{ title_bn: "", subtitle_bn: "", image: "", link: "/products", placement: "home_hero", is_active: true, sort_order: 0 }}
      columns={[
        {
          key: "title_bn",
          label: "শিরোনাম",
          render: (r) => (
            <div>
              <p className="font-medium">{String(r.title_bn)}</p>
              <p className="line-clamp-1 text-[9.5px] text-sand-100/35">{String(r.subtitle_bn ?? "")}</p>
            </div>
          ),
        },
        { key: "placement", label: "স্থান" },
        { key: "link", label: "লিংক", render: (r) => <span className="font-mono text-[10px] text-leaf-200">{String(r.link)}</span> },
        { key: "sort_order", label: "ক্রম" },
        {
          key: "is_active",
          label: "স্টেটাস",
          render: (r) => (
            <span className={`badge !text-[9px] ${r.is_active ? "bg-leaf-600/20 text-leaf-200" : "bg-white/[0.07] text-sand-100/50"}`}>
              {r.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
            </span>
          ),
        },
      ]}
      fields={[
        { name: "title_bn", label: "শিরোনাম", type: "text", required: true },
        { name: "subtitle_bn", label: "উপশিরোনাম", type: "text" },
        { name: "image", label: "ছবির URL", type: "text", colSpan: 2, placeholder: "/images/hero/farm.jpg" },
        { name: "link", label: "লিংক", type: "text" },
        {
          name: "placement",
          label: "স্থান",
          type: "select",
          options: [
            { value: "home_hero", label: "হোম হিরো" },
            { value: "home_mid", label: "হোম মাঝখান" },
            { value: "offers", label: "অফার পেজ" },
          ],
        },
        { name: "sort_order", label: "ক্রম", type: "number" },
        { name: "is_active", label: "সক্রিয়", type: "checkbox", hint: "সাইটে দেখাবে" },
      ]}
    />
  );
}
