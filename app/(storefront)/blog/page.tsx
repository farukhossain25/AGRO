import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { getBlogPosts } from "@/lib/data";
import { SectionHeader } from "@/components/ui";
import { formatDateBn } from "@/lib/format";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "ব্লগ ও স্বাস্থ্য টিপস",
  description:
    "অর্গানিক খাবার, মৌসুমি সবজি, স্বাস্থ্যকর রেসিপি ও খাদ্য নিরাপত্তা নিয়ে বিশ্বাস এগ্রোর ব্লগ।",
  alternates: { canonical: "/blog" },
  openGraph: { title: "ব্লগ ও স্বাস্থ্য টিপস | বিশ্বাস এগ্রো", url: "/blog" },
};

export default async function BlogPage() {
  const posts = await getBlogPosts(24);
  const [featured, ...rest] = posts;

  return (
    <div className="container-x py-8 sm:py-12">
      <header className="mb-8">
        <span className="eyebrow mb-3">ব্লগ</span>
        <h1 className="text-[26px] font-bold sm:text-4xl">স্বাস্থ্যকর খাওয়ার ছোট ছোট পাঠ</h1>
        <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-sand-100/55">
          মৌসুমি সবজি, অর্গানিক খাবার চেনার উপায়, রেসিপি আর পুষ্টি নিয়ে আমাদের লেখা —
          সহজ ভাষায়, ঘরোয়া অভিজ্ঞতা থেকে।
        </p>
      </header>

      {featured ? (
        <Link href={`/blog/${featured.slug}`} className="card card-hover group mb-8 block overflow-hidden lg:grid lg:grid-cols-2">
          <div className="relative aspect-[16/10] lg:aspect-auto">
            {featured.cover ? (
              <Image
                src={featured.cover}
                alt={featured.title_bn}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : null}
            <span className="absolute left-3 top-3 badge bg-leaf-600/90 text-white backdrop-blur">{featured.tag_bn}</span>
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="flex items-center gap-2 text-[11.5px] text-sand-100/40">
              <Clock className="h-3 w-3" /> {featured.read_minutes} মিনিট পড়া · {formatDateBn(featured.published_at)}
            </p>
            <h2 className="mt-2.5 text-[20px] font-bold leading-snug group-hover:text-leaf-200 sm:text-2xl">
              {featured.title_bn}
            </h2>
            <p className="mt-2.5 text-[13px] leading-relaxed text-sand-100/55">{featured.excerpt_bn}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-leaf-300">
              পুরো লেখা পড়ুন <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      ) : null}

      <SectionHeader title="সব লেখা" subtitle={`${posts.length}টি লেখা`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`} className="card card-hover group overflow-hidden">
            <div className="relative aspect-[16/10] overflow-hidden">
              {post.cover ? (
                <Image
                  src={post.cover}
                  alt={post.title_bn}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : null}
              <span className="absolute left-3 top-3 badge bg-ink-950/75 text-leaf-200 backdrop-blur">{post.tag_bn}</span>
            </div>
            <div className="p-4">
              <p className="text-[10.5px] text-sand-100/40">
                {post.read_minutes} মিনিট · {formatDateBn(post.published_at)}
              </p>
              <h3 className="mt-1.5 line-clamp-2 text-[14.5px] font-semibold leading-snug group-hover:text-leaf-200">
                {post.title_bn}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-sand-100/50">{post.excerpt_bn}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
