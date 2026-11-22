import type { Metadata } from "next";
import Link from "next/link";
import { NativeRedirect } from "@/components/auth/native-redirect";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "অ্যাপে ফিরে যান",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* ==========================================================================
   /auth/native — the last hop for the Android app
   --------------------------------------------------------------------------
   Google OAuth cannot return to `capacitor://localhost` or `http://localhost`
   inside the WebView: Supabase only allows http(s) redirect targets. So the
   shell goes to the hosted callback first, which lands here, and this page
   fires the custom scheme registered in AndroidManifest.xml:

       biswasagro://auth-callback

   The deep link uses whatever origin the deployment runs on, so it works on
   https://<project>.vercel.app today and on a custom domain later with no code
   change (only the manifest's intent filter, if you narrow it).

   `to` is validated to start with `biswasagro://` so this page can never be
   used as an open redirect into another app or website.
   ========================================================================== */
export default async function NativeCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const { to } = await searchParams;

  const target = to && to.startsWith("biswasagro://") ? to : "biswasagro://auth-callback";

  return (
    <div className="container-x flex min-h-[60vh] items-center justify-center py-12">
      <div className="card mx-auto max-w-md p-6 text-center sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-leaf-600/15 text-2xl">
          🌾
        </span>
        <h1 className="mt-4 text-lg font-bold">অ্যাপে ফিরে যাচ্ছে…</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-sand-100/60">
          লগইন সম্পন্ন হয়েছে। অ্যাপটি নিজে থেকে খুলে না গেলে নিচের বাটনে চাপ দিন।
        </p>

        <NativeRedirect to={target} />

        <div className="mt-6 border-t border-white/[0.06] pt-4">
          <p className="text-[11.5px] text-sand-100/40">
            অ্যাপ ইনস্টল না থাকলে ব্রাউজারেই চালিয়ে যান — {site.domain}
          </p>
          <Link href="/account" className="btn-ghost btn-sm mt-2">
            ব্রাউজারে অ্যাকাউন্টে যান
          </Link>
        </div>
      </div>
    </div>
  );
}
