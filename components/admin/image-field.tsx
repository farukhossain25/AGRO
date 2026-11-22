"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Link2, Loader2, Upload, X } from "lucide-react";

/* ==========================================================================
   <ImageField /> — upload from the device, never a URL paste
   --------------------------------------------------------------------------
   The brief asks for phone gallery / camera / desktop with drag-and-drop.
   All three are the SAME `<input type="file" accept="image/*">`:
     • mobile browsers offer Gallery / Camera / Files when this is tapped
     • the `capture` attribute is deliberately NOT set, because forcing the
       camera would remove the gallery option
     • drag-and-drop is layered on for desktop

   The component never stores a data URL in the database — it uploads to
   /api/foisal/media and keeps the returned public URL. A URL field is still
   available behind a toggle for one-off external assets, but the default path
   is upload.

   Client-side compression happens before upload when the image is large, so a
   12 MP phone photo does not fail the 6 MB server cap.
   ========================================================================== */

const MAX_INPUT_BYTES = 40 * 1024 * 1024; // reject absurd files before decoding
const TARGET_BYTES = 1.6 * 1024 * 1024;

export type ImageFieldProps = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  bucket?: "product-images" | "hero-slides" | "payment-logos" | "cms-media" | "farm-images";
  hint?: string;
  /** aspect ratio of the preview */
  ratio?: "square" | "wide" | "banner";
  allowUrl?: boolean;
};

export function ImageField({
  value,
  onChange,
  label = "ছবি",
  bucket = "product-images",
  hint,
  ratio = "wide",
  allowUrl = true,
}: ImageFieldProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(false);

  const ratioClass =
    ratio === "square" ? "aspect-square" : ratio === "banner" ? "aspect-[21/9]" : "aspect-video";

  async function handleFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("শুধু ছবি আপলোড করুন");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("ছবিটি অনেক বড় (৪০ MB-এর বেশি)");
      return;
    }

    setBusy(true);
    try {
      const prepared = await compress(file);
      const body = new FormData();
      body.append("file", prepared);
      body.append("bucket", bucket);

      const res = await fetch("/api/foisal/media", { method: "POST", body });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "আপলোড ব্যর্থ");
      onChange(json.data.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-[11.5px] font-medium text-sand-100/70">
          {label}
        </label>
        {allowUrl ? (
          <button
            type="button"
            onClick={() => setUrlMode((v) => !v)}
            className="text-[10.5px] text-sand-100/40 hover:text-leaf-200"
          >
            {urlMode ? "আপলোড করুন" : "লিংক দিন"}
          </button>
        ) : null}
      </div>

      {urlMode ? (
        <div className="flex gap-2">
          <Link2 className="mt-2.5 h-4 w-4 shrink-0 text-sand-100/30" />
          <input
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px]"
            placeholder="https://… অথবা /images/…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {value ? (
            <button type="button" onClick={() => onChange("")} className="px-1 text-sand-100/40" aria-label="মুছুন">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={`relative overflow-hidden rounded-xl border-2 border-dashed transition ${
              dragging ? "border-leaf-400 bg-leaf-600/10" : "border-white/12 bg-white/[0.03]"
            }`}
          >
            <label
              htmlFor={inputId}
              className={`flex ${ratioClass} cursor-pointer items-center justify-center`}
            >
              {value ? (
                <>
                  <Image
                    src={value}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 320px"
                    className="object-cover"
                    unoptimized={value.startsWith("data:")}
                  />
                  <span className="absolute inset-0 grid place-items-center bg-ink-950/0 text-[11px] font-semibold text-transparent transition hover:bg-ink-950/55 hover:text-sand-100">
                    <span className="flex items-center gap-1.5">
                      <Upload className="h-3.5 w-3.5" /> বদলান
                    </span>
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center gap-1.5 px-3 py-6 text-center text-sand-100/35">
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  <span className="text-[11px] font-medium">
                    {busy ? "আপলোড হচ্ছে…" : "ছবি বাছুন / টেনে ছাড়ুন"}
                  </span>
                  <span className="text-[9.5px]">ফোনের গ্যালারি · ক্যামেরা · কম্পিউটার</span>
                </span>
              )}
            </label>

            <input
              id={inputId}
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />

            {value && !busy ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute right-2 top-2 rounded-full bg-ink-950/70 p-1 text-sand-100/70 backdrop-blur hover:text-red-300"
                aria-label="ছবি সরান"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {busy ? (
              <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/10">
                <div className="h-full w-1/2 animate-[shimmer_1.1s_linear_infinite] bg-leaf-400" />
              </div>
            ) : null}
          </div>

          {hint ? <p className="text-[10px] text-sand-100/35">{hint}</p> : null}
          {error ? <p className="text-[10.5px] text-red-300">{error}</p> : null}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- compression */

/**
 * Downscale to ≤1920px and re-encode as WebP until it fits TARGET_BYTES.
 * Runs in the browser, so the server cap is never the thing that rejects a
 * perfectly good phone photo. Animated GIFs and SVG are passed through
 * untouched (canvas would destroy them).
 */
async function compress(file: File): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size <= TARGET_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let quality = 0.86;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality)
      );
      if (blob && blob.size <= TARGET_BYTES) {
        return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
      }
      quality -= 0.16;
    }

    const finalBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.6)
    );
    return finalBlob
      ? new File([finalBlob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" })
      : file;
  } catch {
    // Any decode failure → let the server make the decision.
    return file;
  }
}
