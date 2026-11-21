import { db, isDbConfigured } from "@/lib/db";
import { getBlogPosts } from "@/lib/data";
import { SimpleManager } from "@/components/admin/simple-manager";
import { formatDateBn } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  let rows: Record<string, unknown>[] = (await getBlogPosts()) as unknown as Record<string, unknown>[];

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("blog_posts").select("*").order("published_at", { ascending: false });
      if (data?.length) rows = data;
    } catch {
      /* fall back */
    }
  }

  return (
    <SimpleManager
      title="ব্লগ"
      subtitle={`${rows.length}টি পোস্ট`}
      resource="blog"
      initial={rows}
      dbReady={isDbConfigured()}
      emptyRow={{
        slug: "",
        title_bn: "",
        excerpt_bn: "",
        content_bn: "",
        cover: "/images/cat/vegetables.jpg",
        author_bn: "বিশ্বাস এগ্রো টিম",
        tag_bn: "স্বাস্থ্য টিপস",
        read_minutes: 4,
        is_active: true,
      }}
      columns={[
        {
          key: "title_bn",
          label: "শিরোনাম",
          render: (r) => (
            <div className="max-w-[280px]">
              <p className="line-clamp-1 font-medium">{String(r.title_bn)}</p>
              <p className="truncate text-[9.5px] text-sand-100/35">/{String(r.slug)}</p>
            </div>
          ),
        },
        { key: "tag_bn", label: "ট্যাগ" },
        { key: "author_bn", label: "লেখক" },
        {
          key: "published_at",
          label: "প্রকাশ",
          render: (r) => <span className="text-[11px]">{formatDateBn(String(r.published_at ?? ""))}</span>,
        },
        {
          key: "is_active",
          label: "স্টেটাস",
          render: (r) => (
            <span className={`badge !text-[9px] ${r.is_active ? "bg-leaf-600/20 text-leaf-200" : "bg-white/[0.07] text-sand-100/50"}`}>
              {r.is_active ? "প্রকাশিত" : "খসড়া"}
            </span>
          ),
        },
      ]}
      fields={[
        { name: "title_bn", label: "শিরোনাম", type: "text", required: true, colSpan: 2 },
        { name: "slug", label: "Slug", type: "text", required: true, placeholder: "shak-shobji-upokarita" },
        { name: "tag_bn", label: "ট্যাগ", type: "text" },
        { name: "excerpt_bn", label: "সংক্ষিপ্তসার", type: "textarea", colSpan: 2 },
        { name: "content_bn", label: "বিষয়বস্তু (Markdown)", type: "textarea", required: true, colSpan: 2 },
        { name: "cover", label: "কভার ছবি", type: "text", colSpan: 2, placeholder: "/images/cat/vegetables.jpg" },
        { name: "author_bn", label: "লেখক", type: "text" },
        { name: "read_minutes", label: "পড়ার সময় (মিনিট)", type: "number" },
        { name: "is_active", label: "প্রকাশিত", type: "checkbox", hint: "সাইটে দেখাবে" },
      ]}
    />
  );
}
