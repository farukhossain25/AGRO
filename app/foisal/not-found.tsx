import Link from "next/link";
import { ADMIN_BASE } from "@/lib/paths";

export const metadata = { title: "পাতা পাওয়া যায়নি", robots: { index: false, follow: false } };

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-mono text-[12px] font-bold tracking-widest text-leaf-300">404</p>
      <h1 className="mt-2 text-xl font-bold">এই প্যানেল পৃষ্ঠাটি নেই</h1>
      <p className="mt-2 text-[13px] text-sand-100/55">
        মেনু থেকে সঠিক পৃষ্ঠাটি বেছে নিন, অথবা ড্যাশবোর্ডে ফিরে যান।
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href={ADMIN_BASE} className="btn-primary btn-sm">
          ড্যাশবোর্ড
        </Link>
        <Link href="/" className="btn-ghost btn-sm">
          ওয়েবসাইট
        </Link>
      </div>
    </div>
  );
}
