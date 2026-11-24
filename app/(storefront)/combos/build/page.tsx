import type { Metadata } from "next";
import Link from "next/link";
import { ComboBuilder } from "@/components/combo-builder";
import { getCategories, getProducts } from "@/lib/data";
import { alternatesFor } from "@/lib/seo";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "নিজের কম্বো বানান",
  description:
    "পছন্দের পণ্য বেছে নিজের কম্বো বানান — ৪টি আইটেমে ৫%, ৭টির বেশিতে ৮% ছাড়। স্টক ও দাম সার্ভার থেকে যাচাই হয়।",
  alternates: alternatesFor("/combos/build"),
};

const HOW = [
  { n: "১", t: "পণ্য বাছুন", d: "কমপক্ষে ২টি পণ্য — ক্যাটাগরি বা সার্চ দিয়ে খুঁজুন" },
  { n: "২", t: "ছাড় দেখুন", d: "৪টি আইটেমে ৫%, ৭টির বেশিতে ৮% (সর্বোচ্চ ৳৩০০)" },
  { n: "৩", t: "কার্টে যোগ করুন", d: "বা লগইন করে সেভ করুন — পরে এক ক্লিকে অর্ডার" },
];

/**
 * The "build your own combo" page the footer, /account/combos and the saved
 * combos list point at. It only renders <ComboBuilder />; the builder owns the
 * picking, the discount preview and the POST to /api/combos/custom.
 */
export default async function BuildComboPage() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ inStockOnly: true, limit: 200 }),
  ]);

  return (
    <div className="container-x py-8 sm:py-12">
      <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 text-[12px] text-sand-100/45">
        <Link href="/" className="hover:text-leaf-200">
          হোম
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/combos" className="hover:text-leaf-200">
          কম্বো বক্স
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-sand-100/80">নিজের কম্বো</span>
      </nav>

      <header className="max-w-3xl">
        <span className="eyebrow mb-3">নিজের মতো</span>
        <h1 className="text-[28px] font-bold sm:text-4xl">নিজের কম্বো বানান</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-sand-100/60">
          রেডিমেড বক্সের বাইরে নিজের পছন্দমতো বক্স বানান — যা লাগে তাই নিন, বাড়তি কিছু নয়। যত বেশি
          আইটেম, তত বেশি ছাড়।
        </p>
      </header>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {HOW.map((step) => (
          <li key={step.n} className="card flex items-start gap-3 p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-leaf-600/15 text-[14px] font-bold text-leaf-300">
              {step.n}
            </span>
            <div>
              <p className="text-[12.5px] font-semibold">{step.t}</p>
              <p className="text-[11px] text-sand-100/45">{step.d}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {products.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-[15px] font-semibold">এই মুহূর্তে স্টকে কোনো পণ্য নেই</p>
            <p className="mt-1 text-[12.5px] text-sand-100/50">একটু পরে আবার চেষ্টা করুন, অথবা রেডিমেড কম্বো দেখুন।</p>
            <Link href="/combos" className="btn-primary btn-sm mt-4">
              রেডিমেড কম্বো
            </Link>
          </div>
        ) : (
          <ComboBuilder
            categories={categories.map((c) => ({ id: c.id, name_bn: c.name_bn }))}
            products={products.map((p) => ({
              id: p.id,
              name_bn: p.name_bn,
              unit: p.unit,
              price: Number(p.price),
              image: p.image,
              stock: Number(p.stock),
              category_id: p.category_id,
            }))}
          />
        )}
      </div>
    </div>
  );
}
