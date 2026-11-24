"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { ImageField } from "@/components/admin/image-field";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   <StoreBranding /> — the seller's logo and banner, from the dashboard
   --------------------------------------------------------------------------
   Two <ImageField>s bound to the seller's own row. Tapping a field opens the
   phone's gallery / camera / file picker (one <input type="file"> — no
   `capture`, so the gallery stays an option); desktop gets drag-and-drop. The
   file goes to /api/upload (approved sellers only) and only the returned
   public URL is saved here, via PATCH /api/sellers/profile.
   ========================================================================== */

export function StoreBranding({
  slug,
  name,
  initialLogo,
  initialBanner,
  live,
}: {
  slug: string;
  name: string;
  initialLogo: string | null;
  initialBanner: string | null;
  /** approved → the public store page exists and can be opened */
  live: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [logo, setLogo] = useState(initialLogo ?? "");
  const [banner, setBanner] = useState(initialBanner ?? "");
  const [saving, setSaving] = useState(false);

  const dirty = logo !== (initialLogo ?? "") || banner !== (initialBanner ?? "");

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/sellers/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ logo: logo || null, banner: banner || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "সেভ হয়নি");
      toast.success("স্টোরের ছবি সেভ হয়েছে", live ? "আপনার স্টোর পৃষ্ঠায় এখনই দেখা যাবে" : undefined);
      router.refresh();
    } catch (err) {
      toast.error("সেভ হয়নি", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-bold text-neu-ink">স্টোরের লোগো ও ব্যানার</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-sand-100/50">
            ফোনের গ্যালারি বা কম্পিউটার থেকে সরাসরি ছবি বাছুন — আপনার স্টোর পৃষ্ঠা ও মার্কেটপ্লেসে এটাই দেখাবে।
          </p>
        </div>
        {live ? (
          <Link
            href={`/market/${slug}`}
            target="_blank"
            className="btn-ghost btn-sm shrink-0 min-h-[36px] px-2.5"
            aria-label="স্টোর পৃষ্ঠা দেখুন"
          >
            <ExternalLink className="h-3.5 w-3.5" /> দেখুন
          </Link>
        ) : null}
      </div>

      {!live ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber-200/90">
          সেলার অ্যাকাউন্ট অনুমোদিত হলে এখান থেকে লোগো ও ব্যানার আপলোড করতে পারবেন।
        </p>
      ) : (
        <>
      {/* how it will look on top of the store page */}
      <div className="relative h-24 overflow-hidden rounded-xl border border-white/10 bg-ink-800 sm:h-28">
        {banner ? (
          <Image src={banner} alt="" fill sizes="320px" className="object-cover opacity-60" />
        ) : (
          <div className="grid h-full place-items-center text-[10.5px] text-sand-100/40">ব্যানার এখনো নেই</div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2.5 bg-gradient-to-t from-scrim via-scrim/70 to-transparent p-2.5">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white ring-2 ring-white/70">
            {logo ? (
              <Image src={logo} alt="" fill sizes="40px" className="object-contain p-0.5" />
            ) : (
              <span className="grid h-full place-items-center text-[15px] font-bold text-leaf-700">
                {(name || "স").trim().charAt(0)}
              </span>
            )}
          </div>
          <p className="truncate text-[12.5px] font-bold text-white">{name}</p>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="max-w-[180px]">
          <ImageField
            value={logo}
            onChange={setLogo}
            label="লোগো (বর্গাকার)"
            hint="PNG/WebP, পরিষ্কার পটভূমি — ৫১২×৫১২ হলে ভালো"
            bucket="logos"
            endpoint="/api/upload"
            allowUrl={false}
            ratio="square"
          />
        </div>
        <ImageField
          value={banner}
          onChange={setBanner}
          label="ব্যানার (চওড়া)"
          hint="স্টোর পৃষ্ঠার উপরে দেখাবে — ১৬০০×৬৪০ বা তার কাছাকাছি"
          bucket="farm-images"
          endpoint="/api/upload"
          allowUrl={false}
          ratio="banner"
        />
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={!dirty || saving}
        className="btn-primary btn-sm w-full disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {saving ? "সেভ হচ্ছে…" : "সেভ করুন"}
      </button>
        </>
      )}
    </div>
  );
}
