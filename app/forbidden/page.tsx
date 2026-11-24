import Link from "next/link";
import type { Metadata } from "next";
import { ShieldX } from "lucide-react";

export const metadata: Metadata = {
  title: "প্রবেশাধিকার নেই (403)",
  robots: { index: false, follow: false },
};

/**
 * /forbidden — explicit 403 page.
 * Used when a signed-in non-admin deliberately opens the panel: the middleware
 * sends admins to the login screen, but an authenticated customer landing here
 * gets a clear "Access denied" rather than a login loop.
 */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neu-bg px-6 text-center">
      <span className="neu-raised grid h-16 w-16 place-items-center rounded-2xl bg-red-500/10 !text-[#c0392b]">
        <ShieldX className="h-7 w-7" />
      </span>

      <h1 className="mt-4 text-2xl font-bold">প্রবেশাধিকার নেই</h1>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-neu-muted">
        এই পেজটি শুধুমাত্র অ্যাডমিনদের জন্য। আপনার অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই।
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-widest text-neu-faint">403 · Access denied</p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary">
          হোমে ফিরুন
        </Link>
        <Link href="/account" className="btn-ghost">
          আমার অ্যাকাউন্ট
        </Link>
        <Link href="/contact" className="btn-ghost">
          সহায়তা নিন
        </Link>
      </div>
    </div>
  );
}
