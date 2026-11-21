"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   ComplaintForm — "সমস্যা জানান"
   --------------------------------------------------------------------------
   Opens a ticket for one delivered item. Four fields: problem type,
   description, up to 3 photos, and the resolution the customer wants.
   On success the customer is sent to the ticket thread.
   ========================================================================== */

const PROBLEMS = [
  { value: "spoiled", label: "পচা / নষ্ট", icon: "🥀" },
  { value: "short_weight", label: "কম ওজন", icon: "⚖️" },
  { value: "wrong_item", label: "ভুল পণ্য", icon: "🔀" },
  { value: "late", label: "দেরি হয়েছে", icon: "⏱️" },
  { value: "other", label: "অন্য কিছু", icon: "❓" },
] as const;

const RESOLUTIONS = [
  { value: "refund", label: "টাকা ফেরত", hint: "পণ্যের মূল্য ফেরত চাই" },
  { value: "replacement", label: "পণ্য বদল", hint: "নতুন পণ্য চাই" },
  { value: "inform", label: "শুধু জানাতে চাই", hint: "কোনো ক্ষতিপূরণ দরকার নেই" },
] as const;

export function ComplaintForm({
  orderId,
  productId,
  productNameBn,
  onDone,
  compact = false,
}: {
  orderId: string;
  productId: string;
  productNameBn: string;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [problem, setProblem] = useState<string>("");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState<string>("inform");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<{ id: string; ticketNo: string } | null>(null);

  async function upload(file: File) {
    if (photos.length >= 3) return;
    if (!file.type.startsWith("image/")) return setError("শুধু ছবি আপলোড করুন");
    if (file.size > 4 * 1024 * 1024) return setError("ছবির আকার ৪ MB-এর কম দিন");

    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("bucket", "review-photos");

      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !json.url) throw new Error(json.message ?? "আপলোড ব্যর্থ");
      setPhotos((prev) => [...prev, json.url as string].slice(0, 3));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!problem) return setError("সমস্যার ধরন বেছে নিন");
    if (description.trim().length < 5) return setError("সমস্যাটি অন্তত ৫ অক্ষরে লিখুন");

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          productId,
          problemType: problem,
          description: description.trim(),
          photos,
          resolution,
        }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        id?: string;
        ticketNo?: string;
      };

      if (!res.ok || !json.ticketNo) throw new Error(json.message ?? "অভিযোগ জমা দেওয়া যায়নি");

      setTicket({ id: json.id as string, ticketNo: json.ticketNo });
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (ticket) {
    return (
      <div className="rounded-xl border border-leaf-400/30 bg-leaf-600/10 p-4 text-center">
        <p className="text-[22px]">✅</p>
        <p className="mt-1 text-[13.5px] font-semibold text-leaf-100">
          অভিযোগ জমা হয়েছে — টিকিট #{ticket.ticketNo}
        </p>
        <p className="mt-1 text-[11.5px] text-sand-100/55">
          সেলার ও অ্যাডমিন দুজনেই অবহিত হয়েছেন। সাধারণত ২৪ ঘণ্টার মধ্যে উত্তর পাবেন।
        </p>
        <a href={`/account/complaints/${ticket.id}`} className="btn-primary btn-sm mt-3 min-h-[44px]">
          টিকিট দেখুন
        </a>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-black/25 p-3 ${compact ? "" : "sm:p-4"}`}>
      <p className="text-[12.5px] font-semibold text-sand-50">
        {productNameBn} — সমস্যা জানান
      </p>

      {/* problem type */}
      <fieldset className="mt-2.5">
        <legend className="mb-1.5 text-[11.5px] text-sand-100/55">কী সমস্যা হয়েছে?</legend>
        <div className="flex flex-wrap gap-1.5">
          {PROBLEMS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={problem === p.value}
              onClick={() => setProblem(p.value)}
              className={`badge h-9 px-2.5 text-[11.5px] transition ${
                problem === p.value
                  ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40"
                  : "bg-white/[0.05] text-sand-100/60 hover:bg-white/[0.09]"
              }`}
            >
              <span aria-hidden>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="বিস্তারিত লিখুন — কী হয়েছে, কখন বুঝতে পারলেন…"
        className="input mt-2.5 text-[16px] sm:text-[13.5px]"
      />

      {/* photos */}
      <div className="mt-2.5">
        <p className="mb-1.5 text-[11.5px] text-sand-100/55">ছবি ({photos.length}/৩)</p>
        <div className="flex flex-wrap items-center gap-2">
          {photos.map((src) => (
            <span key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="সমস্যার ছবি" width={52} height={52} className="h-13 w-13 rounded-lg object-cover" style={{ height: 52, width: 52 }} />
              <button
                type="button"
                aria-label="ছবি সরান"
                onClick={() => setPhotos((prev) => prev.filter((p) => p !== src))}
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-[12px] text-white"
              >
                ×
              </button>
            </span>
          ))}
          {photos.length < 3 ? (
            <label className="grid h-[52px] w-[52px] cursor-pointer place-items-center rounded-lg border border-dashed border-white/25 text-[18px] text-sand-100/50 hover:border-amber-400/60 hover:text-amber-200">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
              {uploading ? <Spinner /> : "+"}
            </label>
          ) : null}
        </div>
      </div>

      {/* resolution */}
      <fieldset className="mt-2.5">
        <legend className="mb-1.5 text-[11.5px] text-sand-100/55">আপনি কী চান?</legend>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={resolution === r.value}
              onClick={() => setResolution(r.value)}
              className={`rounded-lg border px-2.5 py-2 text-left transition ${
                resolution === r.value
                  ? "border-leaf-400/50 bg-leaf-600/15"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
            >
              <span className="block text-[12px] font-semibold text-sand-50">{r.label}</span>
              <span className="block text-[10.5px] text-sand-100/45">{r.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-2.5 rounded-lg bg-red-500/10 px-2.5 py-2 text-[11.5px] text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="btn-primary btn-sm mt-3 min-h-[44px] w-full sm:w-auto"
      >
        {busy ? <Spinner /> : null} অভিযোগ জমা দিন
      </button>

      <p className="mt-2 text-[10.5px] leading-4 text-sand-100/35">
        জমা দেওয়ার পর সেলার ও অ্যাডমিন সাথে সাথে অবহিত হবেন। স্ট্যাটাস: খোলা → পর্যালোচনায় →
        সমাধান / বাতিল।
      </p>
    </div>
  );
}
