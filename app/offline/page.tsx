import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "অফলাইন", robots: { index: false } };

/** Served by the service worker when a navigation fails while offline. */
export default function OfflinePage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/12">
          <WifiOff className="h-6 w-6 text-amber-300" />
        </span>
        <h1 className="mt-4 text-xl font-bold">আপনি অফলাইনে আছেন</h1>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-sand-100/55">
          ইন্টারনেট সংযোগ ফিরে এলে পেজটি নিজে থেকেই লোড হবে। আগে দেখা পেজগুলো ক্যাশ থেকে খোলা যাবে।
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/" className="btn-primary btn-sm">
            আবার চেষ্টা করুন
          </Link>
          <Link href="/live" className="btn-ghost btn-sm">
            লাইভ খামার
          </Link>
        </div>
      </div>
    </div>
  );
}
