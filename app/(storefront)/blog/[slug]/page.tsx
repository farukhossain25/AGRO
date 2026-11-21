import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Share2, User } from "lucide-react";
import { getBlogPost, getBlogPosts } from "@/lib/data";
import { formatDateBn } from "@/lib/format";
import { site } from "@/lib/site";

export const revalidate = 600;

export async function generateStaticParams() {
  const posts = await getBlogPosts(24).catch(() => []);
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "লেখাটি পাওয়া যায়নি" };
  return {
    title: post.title_bn,
    description: post.excerpt_bn ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title_bn,
      description: post.excerpt_bn ?? undefined,
      images: post.cover ? [{ url: post.cover }] : undefined,
      publishedTime: post.published_at,
      authors: [post.author_bn],
      url: `/blog/${post.slug}`,
    },
  };
}

/** Minimal, safe markdown renderer for our own seed content (no HTML injection). */
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const inline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={i} className="font-semibold text-leaf-200">{p.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{p}</span>
      )
    );
  };

  const flushList = () => {
    if (!list.length) return;
    out.push(
      <ul key={`ul-${key++}`}>
        {list.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushList();
      out.push(<h2 key={key++}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      flushList();
      out.push(<h3 key={key++}>{line.slice(4)}</h3>);
    } else if (line.startsWith("- ")) {
      list.push(line.slice(2));
    } else if (line === "") {
      flushList();
    } else {
      flushList();
      out.push(<p key={key++}>{inline(line)}</p>);
    }
  }
  flushList();
  return out;
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const others = (await getBlogPosts(6)).filter((p) => p.slug !== post.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title_bn,
    description: post.excerpt_bn,
    image: post.cover ? `${site.url}${post.cover}` : undefined,
    datePublished: post.published_at,
    author: { "@type": "Organization", name: post.author_bn },
    publisher: { "@type": "Organization", name: site.nameBn, logo: { "@type": "ImageObject", url: `${site.url}/favicon.svg` } },
    mainEntityOfPage: `${site.url}/blog/${post.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="container-x py-8 sm:py-12">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[12px] text-sand-100/45 hover:text-leaf-200">
          <ArrowLeft className="h-3.5 w-3.5" /> সব লেখা
        </Link>

        <header className="mx-auto mt-5 max-w-3xl">
          <span className="eyebrow mb-3">{post.tag_bn}</span>
          <h1 className="text-[26px] font-bold leading-tight sm:text-[38px]">{post.title_bn}</h1>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-sand-100/45">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {post.author_bn}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {post.read_minutes} মিনিট পড়া</span>
            <span>{formatDateBn(post.published_at)}</span>
          </div>
        </header>

        {post.cover ? (
          <div className="relative mx-auto mt-6 aspect-[16/9] max-w-4xl overflow-hidden rounded-[1.75rem] border border-white/[0.06]">
            <Image src={post.cover} alt={post.title_bn} fill priority sizes="(max-width: 1024px) 100vw, 900px" className="object-cover" />
          </div>
        ) : null}

        <div className="prose-bn mx-auto mt-8 max-w-3xl">{renderMarkdown(post.content_bn)}</div>

        <div className="mx-auto mt-8 flex max-w-3xl items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
          <p className="text-[12px] text-sand-100/45">লেখাটি ভালো লাগলে শেয়ার করুন</p>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${site.url}/blog/${post.slug}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost btn-sm"
          >
            <Share2 className="h-3.5 w-3.5" /> শেয়ার
          </a>
        </div>

        {others.length ? (
          <section className="mx-auto mt-12 max-w-4xl">
            <h2 className="mb-4 text-[18px] font-bold">আরও পড়ুন</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {others.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="card card-hover group overflow-hidden">
                  <div className="relative aspect-[16/10]">
                    {p.cover ? <Image src={p.cover} alt={p.title_bn} fill sizes="33vw" className="object-cover" /> : null}
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] text-leaf-300/70">{p.tag_bn}</p>
                    <p className="mt-1 line-clamp-2 text-[12.5px] font-semibold group-hover:text-leaf-200">{p.title_bn}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </>
  );
}
