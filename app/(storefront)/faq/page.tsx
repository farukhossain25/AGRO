import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FaqAccordion } from "@/components/faq-accordion";
import { site } from "@/lib/site";
import { alternatesFor, breadcrumbLd, faqLd, jsonLdScript } from "@/lib/seo";
import { withSeo } from "@/lib/seo-db";
import { getFaqGroups } from "@/lib/cms";

/* Built-in copy is the fallback; the panel’s SEO screen can override it per route
   without a deploy (migration 0006). */
export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/faq", {
    title: "সাধারণ প্রশ্ন (FAQ)",
    description:
      "বিশ্বাস এগ্রো নিয়ে সাধারণ প্রশ্নের উত্তর — ডেলিভারি, পেমেন্ট, রিটার্ন, সাবস্ক্রিপশন ও পণ্যের গুণমান।",
    alternates: alternatesFor("/faq"),
  });
}

/* Questions and answers live in `faq_items` (migration 0007) so the team can
   edit them at the panel’s FAQ screen. lib/cms.ts keeps a small bundled fallback for when
   the database is unreachable, so this page never renders empty. */
export const revalidate = 300;

export default async function FaqPage() {
  const groups = await getFaqGroups();

  /* FAQPage rich result — every question here must be visible on the page
     (Google penalises markup that has no matching on-page content). */
  const faq = faqLd(groups.flatMap((group) => group.items));
  const crumbs = breadcrumbLd([{ name: "হোম", href: "/" }, { name: "সাধারণ প্রশ্ন" }]);

  return (
    <div className="container-x py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faq) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(crumbs) }}
      />
      <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 flex items-center gap-1 text-[12px] text-sand-100/45">
        <Link href="/" className="hover:text-leaf-200">হোম</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-sand-100/80">সাধারণ প্রশ্ন</span>
      </nav>

      <header className="mb-8 max-w-2xl">
        <span className="eyebrow mb-3">সাহায্য কেন্দ্র</span>
        <h1 className="text-[26px] font-bold sm:text-4xl">সাধারণ প্রশ্ন ও উত্তর</h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-sand-100/55">
          আপনার প্রশ্নের উত্তর এখানে না পেলে আমাদের হোয়াটসঅ্যাপ ({site.phoneDisplay}) এ মেসেজ করুন — দ্রুত উত্তর পাবেন।
        </p>
      </header>

      <div className="mx-auto max-w-3xl space-y-8">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-[17px] font-bold">{g.title}</h2>
            <FaqAccordion items={g.items} />
          </section>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-3xl">
        <div className="card flex flex-col items-center justify-between gap-3 p-5 text-center sm:flex-row sm:text-left">
          <p className="text-[13px] text-sand-100/65">আরও প্রশ্ন আছে? আমরা সরাসরি কথা বলতে পারি।</p>
          <div className="flex gap-2">
            <Link href="/contact" className="btn-primary btn-sm">যোগাযোগ করুন</Link>
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
              হোয়াটসঅ্যাপ
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
