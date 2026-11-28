"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Tv, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   ChannelList — the channels a seller has already published
   --------------------------------------------------------------------------
   No URL is shown. The link is not a secret in the way a camera password is,
   but it is the owner's source, and a seller who wants to check it can open the
   live page instead — which is the rendering that actually matters.
   ========================================================================== */

export type SellerChannel = {
  id: string;
  name_bn: string;
  status: string;
  stream_url: string | null;
};

export function ChannelList({ channels, farmSlug }: { channels: SellerChannel[]; farmSlug: string | null }) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!channels.length) return null;

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      const res = await fetch(`/api/sellers/channels/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        errorToast("মুছে ফেলা যায়নি", json?.message);
        return;
      }
      success("চ্যানেল মুছে ফেলা হয়েছে");
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setRemoving(null);
      setConfirming(null);
    }
  };

  return (
    <section className="card mb-4 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-mint" />
          <p className="text-[13px] font-bold text-neu-ink">আপনার টিভি চ্যানেল</p>
        </div>
        {farmSlug && (
          <Link href={`/live/farms/${farmSlug}`} className="text-[11.5px] text-mint hover:underline">
            লাইভ পেজ →
          </Link>
        )}
      </div>

      <ul className="space-y-2">
        {channels.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
            {c.status === "online" ? (
              <Wifi className="h-3.5 w-3.5 shrink-0 text-mint" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 shrink-0 text-sand-100/35" />
            )}
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-neu-ink">{c.name_bn}</span>

            {confirming === c.id ? (
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  disabled={removing === c.id}
                  className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-300"
                >
                  {removing === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "মুছুন"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70"
                >
                  না
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(c.id)}
                aria-label={`${c.name_bn} মুছে ফেলুন`}
                className="shrink-0 rounded-full p-1.5 text-sand-100/35 transition hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
