"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tv } from "lucide-react";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   ChannelForm — a seller pastes a live TV link
   --------------------------------------------------------------------------
   The point of this form is what it does NOT ask for: no IP address, no port,
   no router, no VPS. A camera needs all of those; a channel needs a URL. While
   the farm has no public IP, this is the live video a seller can actually
   publish today.
   ========================================================================== */

export function ChannelForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/sellers/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name_bn: name, stream_url: url }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        errorToast("চ্যানেল যোগ করা যায়নি", json?.message);
        return;
      }

      success("চ্যানেল যোগ হয়েছে", "আপনার খামারের লাইভ পেজে এখনই দেখা যাবে");
      setName("");
      setUrl("");
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা", "ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Tv className="h-4 w-4 text-mint" />
        <p className="text-[13px] font-bold text-neu-ink">লাইভ টিভি চ্যানেল যোগ করুন</p>
      </div>
      <p className="text-[11.5px] leading-relaxed text-sand-100/55">
        পাবলিক IP বা ভিপিএস ছাড়াই চলে। চ্যানেলের <code className="rounded bg-white/[0.06] px-1">.m3u8</code> লিংক
        দিন — বা একটি <code className="rounded bg-white/[0.06] px-1">.m3u</code> তালিকা দিলে তার প্রথম HLS চ্যানেলটি
        চলবে। চ্যানেল সবার জন্য ফ্রি দেখাবে, সাবস্ক্রিপশন লাগবে না।
      </p>

      <div>
        <label className="label" htmlFor="channel_name">
          চ্যানেলের নাম
        </label>
        <input
          id="channel_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="যেমন: কৃষি সংবাদ"
          maxLength={80}
          required
          disabled={disabled || saving}
        />
      </div>

      <div>
        <label className="label" htmlFor="channel_url">
          স্ট্রিম লিংক
        </label>
        <input
          id="channel_url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="input"
          placeholder="https://example.com/live/channel.m3u8"
          inputMode="url"
          required
          disabled={disabled || saving}
        />
      </div>

      <button type="submit" className="btn-primary btn-sm" disabled={disabled || saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        চ্যানেল যোগ করুন
      </button>

      {disabled && (
        <p className="text-[11px] text-amber-300">
          চ্যানেল যোগ করতে আগে সেলার অ্যাকাউন্ট অনুমোদন হতে হবে।
        </p>
      )}
    </form>
  );
}
