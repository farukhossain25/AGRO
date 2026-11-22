import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { site } from "@/lib/site";
import { SocialLinksList } from "@/components/social-links";
import { alternatesFor } from "@/lib/seo";
import { withSeo } from "@/lib/seo-db";

/* Built-in copy is the fallback; the panel’s SEO screen can override it per route
   without a deploy (migration 0006). */
export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/contact", {
    title: "যোগাযোগ",
    description:
      "বিশ্বাস এগ্রোর সাথে যোগাযোগ করুন — ফোন, হোয়াটসঅ্যাপ, ইমেইল বা অফিসে। ঢাকা, ধানমন্ডি। সকাল ৭টা থেকে রাত ১০টা।",
    alternates: alternatesFor("/contact"),
    openGraph: { title: "যোগাযোগ | বিশ্বাস এগ্রো", url: "/contact" },
  });
}

export default function ContactPage() {
  const wa = `https://wa.me/${site.whatsapp}`;

  return (
    <div className="container-x py-8 sm:py-12">
      <header className="mb-8">
        <span className="eyebrow mb-3">যোগাযোগ</span>
        <h1 className="text-[26px] font-bold sm:text-4xl">আমরা শুনতে চাই</h1>
        <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-sand-100/55">
          অর্ডার, ডেলিভারি, পণ্যের গুণমান বা যেকোনো পরামর্শ — যেকোনো বিষয়ে আমাদের জানান।
          সাধারণত ৩০ মিনিটের মধ্যে উত্তর দিই।
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3">
          <a href={`tel:${site.phone}`} className="card card-hover flex items-center gap-3.5 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
              <Phone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-sand-100/40">ফোন</p>
              <p className="text-[14px] font-semibold">{site.phoneDisplay}</p>
              <p className="text-[11px] text-sand-100/45">{site.hoursBn}</p>
            </div>
          </a>

          <a href={wa} target="_blank" rel="noopener noreferrer" className="card card-hover flex items-center gap-3.5 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#25D366]/20 text-[#25D366]">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-sand-100/40">হোয়াটসঅ্যাপ</p>
              <p className="text-[14px] font-semibold">চ্যাট করুন</p>
              <p className="text-[11px] text-sand-100/45">সবচেয়ে দ্রুত উত্তর</p>
            </div>
          </a>

          <a href={`mailto:${site.email}`} className="card card-hover flex items-center gap-3.5 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-sand-100/40">ইমেইল</p>
              <p className="text-[14px] font-semibold">{site.email}</p>
              <p className="text-[11px] text-sand-100/45">২৪ ঘণ্টার মধ্যে উত্তর</p>
            </div>
          </a>

          <div className="card flex items-start gap-3.5 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-sand-100/40">অফিস</p>
              <p className="text-[13px] font-semibold leading-relaxed">{site.addressBn}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-sand-100/45">
                <Clock className="h-3 w-3" /> {site.hoursBn}
              </p>
            </div>
          </div>

          {/* Admin-managed: /foisal/social → "যোগাযোগ পেজে দেখান" */}
          <SocialLinksList placement="contact" />

          <div className="card overflow-hidden p-0">
            <iframe
              src={site.mapEmbed}
              title="বিশ্বাস এগ্রো অফিসের ম্যাপ"
              width="100%"
              height="220"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block border-0 grayscale-[35%]"
            />
          </div>
        </div>

        <div>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
