import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ShieldCheck } from "lucide-react";
import { policies, type Policy } from "@/lib/policies";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = policies[slug as Policy["slug"]];
  if (!policy) return { title: "পৃষ্ঠা পাওয়া যায়নি" };
  return {
    title: policy.titleBn,
    description: `${policy.titleBn} — বিশ্বাস এগ্রো। সর্বশেষ আপডেট: ${policy.updated}`,
    alternates: { canonical: `/policies/${policy.slug}` },
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = policies[slug as Policy["slug"]];
  if (!policy) notFound();

  const others = Object.values(policies).filter((p) => p.slug !== policy.slug);

  return (
    <div className="container-x py-8 sm:py-12">
      <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 text-[12px] text-sand-100/45">
        <Link href="/" className="hover:text-leaf-200">হোম</Link>
        <span className="mx-1.5">/</span>
        <span className="text-sand-100/80">{policy.titleBn}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-sand-100/40">
              <FileText className="h-3 w-3" /> নীতিমালা
            </p>
            <ul className="space-y-1">
              {Object.values(policies).map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/policies/${p.slug}`}
                    className={`block rounded-lg px-2.5 py-2 text-[12.5px] transition ${
                      p.slug === policy.slug
                        ? "bg-leaf-600/20 font-semibold text-leaf-200"
                        : "text-sand-100/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    {p.titleBn}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <article className="max-w-3xl">
          <span className="eyebrow mb-3">
            <ShieldCheck className="h-3.5 w-3.5" /> {policy.titleEn}
          </span>
          <h1 className="text-[26px] font-bold sm:text-4xl">{policy.titleBn}</h1>
          <p className="mt-2 text-[12px] text-sand-100/45">সর্বশেষ আপডেট: {policy.updated}</p>

          <div className="prose-bn mt-7">
            {policy.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </section>
            ))}
          </div>

          <div className="card mt-8 p-5">
            <p className="text-[12.5px] leading-relaxed text-sand-100/60">
              কোনো প্রশ্ন থাকলে যোগাযোগ করুন:{" "}
              <a href={`mailto:${site.email}`} className="text-leaf-300 hover:underline">{site.email}</a>{" "}
              · <a href={`tel:${site.phone}`} className="text-leaf-300 hover:underline">{site.phoneDisplay}</a>
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {others.map((p) => (
              <Link key={p.slug} href={`/policies/${p.slug}`} className="btn-ghost btn-sm">
                {p.titleBn}
              </Link>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
