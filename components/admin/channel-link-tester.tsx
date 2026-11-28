"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Radio, XCircle } from "lucide-react";

/* ==========================================================================
   ChannelLinkTester — "why is this channel not playing?"
   --------------------------------------------------------------------------
   The live player can only ever say one thing when a link is not a stream:
   "লাইভ লোড হচ্ছে…". From the outside that is indistinguishable from a slow
   network, so the owner has no way to tell whether the URL, the host or the
   channel is at fault — which is exactly the round trip this component
   removes.

   It asks the server to walk the same chain the player walks and reports each
   hop: what the body actually was (a channel LIST, a master playlist, a media
   playlist), where it pointed next, and which hop failed. Server-side, because
   the browser cannot read those bodies cross-origin.
   ========================================================================== */

type Hop = {
  hop: number;
  url: string;
  status?: number;
  contentType?: string;
  kind?: string;
  bytes?: number;
  next?: string;
  error?: string;
};

/* `reached` is the chain's verdict. The envelope's own `ok` only says the
   request was answered — a dead channel is still a successful check. */
type Answer = { reached: boolean; finalUrl: string | null; hops: Hop[]; message: string };

const KIND_BN: Record<string, string> = {
  list: "চ্যানেল তালিকা",
  master: "মাস্টার প্লেলিস্ট (ভিডিও স্ট্রিম)",
  media: "ভিডিও স্ট্রিম",
  unknown: "অজানা",
};

export function ChannelLinkTester() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setAnswer(null);
    setError(null);
    try {
      const res = await fetch("/api/foisal/channel-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? "পরীক্ষা করা যাচ্ছে না");
        return;
      }
      setAnswer(json.data as Answer);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-mint" />
        <p className="text-[13px] font-bold text-neu-ink">লিংক পরীক্ষা করুন</p>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-sand-100/55">
        চ্যানেল যোগ করার আগে লিংকটি এখানে দিয়ে দেখুন সার্ভার থেকে আদৌ কোনো স্ট্রিম পাওয়া যায় কি না — প্লেয়ারের
        চিরকালীন “লোড হচ্ছে” এর বদলে কোন ধাপে আটকাচ্ছে সেটা দেখা যাবে।
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          className="input flex-1"
          placeholder="https://example.com/list.m3u8"
          inputMode="url"
          aria-label="পরীক্ষা করার লিংক"
        />
        <button type="button" onClick={() => void run()} disabled={busy || !url.trim()} className="btn-primary btn-sm shrink-0">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          পরীক্ষা করুন
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-[12px] text-red-300">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {answer && (
        <div className="mt-3 space-y-2">
          <p className={`flex items-start gap-1.5 text-[12px] font-semibold ${answer.reached ? "text-mint" : "text-amber-300"}`}>
            {answer.reached ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            {answer.message}
          </p>

          <ol className="space-y-1.5">
            {answer.hops.map((h) => (
              <li key={h.hop} className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2">
                <p className="text-[11px] text-sand-100/45">
                  ধাপ {h.hop} · {h.status ? `HTTP ${h.status}` : "—"} · {h.contentType ?? "—"}
                  {h.bytes ? ` · ${h.bytes} বাইট` : ""}
                </p>
                <p className="mt-0.5 break-all text-[11.5px] text-sand-100/75">{h.url}</p>
                {h.kind && (
                  <p className="mt-0.5 text-[11.5px] text-sand-100/60">
                    ধরন: <span className="font-semibold text-neu-ink">{KIND_BN[h.kind] ?? h.kind}</span>
                  </p>
                )}
                {h.error && <p className="mt-0.5 text-[11.5px] text-red-300">{h.error}</p>}
                {h.next && <p className="mt-0.5 break-all text-[11px] text-mint/80">→ {h.next}</p>}
              </li>
            ))}
          </ol>

          {answer.finalUrl && (
            <p className="break-all rounded-lg bg-leaf-900/20 px-2.5 py-2 text-[11px] text-sand-100/70">
              প্লেয়ার এই ঠিকানাটি চালাবে: <span className="text-mint">{answer.finalUrl}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
