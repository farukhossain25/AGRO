import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ShieldCheck } from "lucide-react";
import { formatDateBn } from "@/lib/format";
import { getCmsPage } from "@/lib/cms";
import { CmsBlocks } from "@/components/cms/blocks";
import { policies } from "@/lib/policies";
import { site } from "@/lib/site";
import { dynamicAlternates } from "@/lib/seo";

/* Content now comes from `cms_pages` (migration 0007) so the legal copy is
   editable at the panel’s pages screen. lib/cms.ts falls back to lib/policies.ts when the
   table is empty, which is why this page still prerenders without a database. */
export const revalidate = 600;

const POLICY_SLUGS = Object.keys(policies);

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) return { title: "পৃষ্ঠা পাওয়া যায়নি" };
  return {
    title: page.seo_title ?? page.title_bn,
    description: page.seo_description ?? `${page.title_bn} — বিশ্বাস এগ্রো।`,
    alternates: dynamicAlternates(`/policies/${page.slug}`),
    robots: page.is_published ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) notFound();

  const others = POLICY_SLUGS.filter((s) => s !== page.slug);

  return (
    <div className="container-x py-8 sm:py-12">
      <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 text-[12px] text-sand-100/45">
        <Link href="/" className="hover:text-leaf-200">হোম</Link>
        <span className="mx-1.5">/</span>
        <span className="text-sand-100/80">{page.title_bn}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-sand-100/40">
              <FileText className="h-3 w-3" /> নীতিমালা
            </p>
            <ul className="space-y-1">
              {POLICY_SLUGS.map((s) => (
                <li key={s}>
                  <Link
                    href={`/policies/${s}`}
                    className={`block rounded-lg px-2.5 py-2 text-[12.5px] transition ${
                      s === page.slug
                        ? "bg-leaf-600/20 font-semibold text-leaf-700"
                        : "text-sand-100/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    {policies[s as keyof typeof policies].titleBn}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <article className="max-w-3xl">
          <span className="eyebrow mb-3">
            <ShieldCheck className="h-3.5 w-3.5" /> {page.title_en ?? "Legal"}
          </span>
          <h1 className="text-[26px] font-bold sm:text-4xl">{page.title_bn}</h1>
          <p className="mt-2 text-[12px] text-sand-100/45">
            সর্বশেষ আপডেট: {formatDateBn(page.updated_at)}
          </p>

          <div className="mt-7">
            <CmsBlocks blocks={page.blocks} />
          </div>

          <div className="card mt-8 p-5">
            <p className="text-[12.5px] leading-relaxed text-sand-100/60">
              কোনো প্রশ্ন থাকলে যোগাযোগ করুন:{" "}
              <a href={`mailto:${site.email}`} className="text-leaf-300 hover:underline">{site.email}</a>{" "}
              · <a href={`tel:${site.phone}`} className="text-leaf-300 hover:underline">{site.phoneDisplay}</a>
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {others.map((s) => (
              <Link key={s} href={`/policies/${s}`} className="btn-ghost btn-sm">
                {policies[s as keyof typeof policies].titleBn}
              </Link>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
