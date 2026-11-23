"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StorageBucket } from "@/lib/storage-buckets";

export interface ImageUploaderProps {
  bucket: StorageBucket;
  /** Optional subfolder inside the bucket, e.g. `payment-methods` or `${sellerId}` */
  folder?: string;
  value?: string | null;
  onChange: (url: string) => void;
  onRemove?: () => void;
  label?: string;
  hint?: string;
  maxSizeMB?: number;
  /** Compress images client-side before upload (default true) */
  compress?: boolean;
  /** Max width/height in px when compressing (default 1600) */
  maxDimension?: number;
  className?: string;
  disabled?: boolean;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"];

async function compressImage(file: File, maxDimension: number): Promise<Blob> {
  if (file.type === "image/svg+xml" || file.size < 120 * 1024) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const outType = file.type === "image/png" ? "image/png" : "image/webp";
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        outType,
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function formatStorageError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("bucket not found") || lower.includes("not found")) {
    return "আপলোড ব্যর্থ: Bucket নেই, SQL ফাইল 14 (14_storage_fix.sql) চালান।";
  }
  if (lower.includes("row-level security") || lower.includes("policy") || lower.includes("unauthorized")) {
    return "আপলোড ব্যর্থ: আপনার এই ফোল্ডারে আপলোডের অনুমতি নেই।";
  }
  if (lower.includes("payload too large") || lower.includes("exceeded the maximum")) {
    return "আপলোড ব্যর্থ: ছবির সাইজ অনেক বড়। ছোট ছবি দিন।";
  }
  return `আপলোড ব্যর্থ: ${msg}`;
}

export function ImageUploader({
  bucket,
  folder,
  value,
  onChange,
  onRemove,
  label = "ছবি আপলোড করুন",
  hint = "PNG, JPG, WebP (সর্বোচ্চ ৫ MB)",
  maxSizeMB = 5,
  compress = true,
  maxDimension = 1600,
  className = "",
  disabled = false,
}: ImageUploaderProps) {
  const inputId = useId();
  const cameraId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return;
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("শুধুমাত্র JPG, PNG, WebP, AVIF বা SVG ছবি আপলোড করা যাবে।");
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`ছবির সাইজ ${maxSizeMB} MB-এর কম হতে হবে।`);
        return;
      }

      setUploading(true);
      try {
        const payload = compress ? await compressImage(file, maxDimension) : file;
        const ext =
          file.type === "image/svg+xml"
            ? "svg"
            : file.type === "image/png"
              ? "png"
              : compress
                ? "webp"
                : file.name.split(".").pop() || "jpg";
        const randomName = `${crypto.randomUUID()}.${ext}`;
        const cleanFolder = folder ? folder.replace(/^\/+|\/+$/g, "") : "";
        const path = cleanFolder ? `${cleanFolder}/${randomName}` : randomName;

        const supabase = createClient();
        const { error: uploadErr } = await supabase.storage
          .from(bucket)
          .upload(path, payload, {
            contentType: payload instanceof File ? payload.type : file.type === "image/png" ? "image/png" : "image/webp",
            upsert: false,
          });

        if (uploadErr) {
          setError(formatStorageError(uploadErr.message));
          return;
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        onChange(data.publicUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "অজানা ত্রুটি";
        setError(formatStorageError(msg));
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [bucket, compress, disabled, folder, maxDimension, maxSizeMB, onChange]
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {label ? <span className="block text-[12px] font-semibold text-sand-100/80">{label}</span> : null}

      {value ? (
        <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="আপলোড করা ছবি"
            className="h-16 w-16 shrink-0 rounded-xl border border-white/10 object-cover bg-ink-950"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-sand-100/80">ছবি আপলোড হয়েছে</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <label
                htmlFor={inputId}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-sand-100/80 hover:bg-white/10"
              >
                <ImagePlus className="h-3.5 w-3.5" /> পরিবর্তন করুন
              </label>
              {onRemove ? (
                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> সরান
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-5 text-center transition ${
            dragOver
              ? "border-leaf-400 bg-leaf-500/10"
              : "border-white/15 bg-white/[0.02] hover:border-white/25"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="h-6 w-6 animate-spin text-leaf-400" />
              <p className="text-[12px] font-medium text-sand-100/70">আপলোড হচ্ছে…</p>
            </div>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-leaf-400/80" />
              <p className="mt-2 text-[12.5px] font-medium text-sand-100/80">
                ছবি টেনে আনুন অথবা নিচ থেকে বাছাই করুন
              </p>
              <p className="mt-0.5 text-[11px] text-sand-100/45">{hint}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <label
                  htmlFor={inputId}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-leaf-500/30 bg-leaf-500/15 px-3 py-1.5 text-[11.5px] font-semibold text-leaf-200 hover:bg-leaf-500/25"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> গ্যালারি / ফাইল
                </label>
                <label
                  htmlFor={cameraId}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11.5px] font-medium text-sand-100/80 hover:bg-white/10 sm:hidden"
                >
                  <Camera className="h-3.5 w-3.5" /> ক্যামেরা
                </label>
              </div>
            </>
          )}
        </div>
      )}

      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {error ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11.5px] font-medium text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
