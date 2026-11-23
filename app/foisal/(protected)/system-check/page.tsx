import { SystemCheck } from "@/components/admin/system-check";

export const dynamic = "force-dynamic";

/**
 * /foisal/system-check
 *
 * A built-in smoke test: it reads and writes every critical table, lists the
 * storage buckets, uploads a 1-byte probe and deletes it again, and checks the
 * env var *names*. Green means the panel can really talk to Supabase; red
 * prints the raw Postgres/storage sentence so nothing has to be guessed.
 */
export default function SystemCheckPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[20px] font-bold sm:text-2xl">সিস্টেম চেক</h1>
        <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-sand-100/50">
          এক ক্লিকে লাইভ পরীক্ষা — প্রতিটি টেবিল পড়া/লেখা, স্টোরেজ বাকেট, আপলোড, অ্যাডমিন RLS আর
          এনভায়রনমেন্ট ভেরিয়েবলের নাম। কিছু লাল হলে নিচে আসল কারণ লেখা থাকবে।
        </p>
      </header>
      <SystemCheck />
    </div>
  );
}
