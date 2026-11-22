"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui";

/**
 * Admin upload button for the media library. Posts to /api/foisal/media, which
 * stores the file in a public bucket and indexes it in `media_assets`.
 * The picker is a plain <label>+<input type="file"> so it works with a keyboard
 * and on iOS without any JS branching.
 */
export function MediaUploader() {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [alt, setAlt] = useState("");

  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("bucket", "product-images");
      body.append("alt", alt);
      const res = await fetch("/api/foisal/media", { method: "POST", body });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "আপলোড ব্যর্থ");
      toast.success("আপলোড হয়েছে", "লাইব্রেরিতে যোগ হয়েছে");
      setAlt("");
      router.refresh();
    } catch (error) {
      toast.error("আপলোড হয়নি", (error as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="w-44 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] placeholder:text-sand-100/30 focus:border-leaf-500/60 focus:outline-none"
        placeholder="alt টেক্সট (ঐচ্ছিক)"
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        aria-label="ছবির বর্ণনা"
      />
      <label
        className={`btn-primary inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-[13px] font-semibold ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        ছবি আপলোড
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </label>
    </div>
  );
}
