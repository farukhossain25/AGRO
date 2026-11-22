"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast";

export function CameraRequestForm({ hasFarm }: { hasFarm: boolean }) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [count, setCount] = useState(2);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/sellers/camera-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ camera_count: count, note_bn: note }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("রিকোয়েস্ট পাঠানো যায়নি", json?.message);
        return;
      }

      success("রিকোয়েস্ট পাঠানো হয়েছে", "আমাদের টিম ২ কর্মদিবসের মধ্যে যোগাযোগ করবে");
      setNote("");
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div>
        <label className="label" htmlFor="camera_count">কতটি ক্যামেরা চান?</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`chip ${count === n ? "chip-active" : ""}`}
            >
              {n}টি
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note_bn">কোথায় বসাতে চান?</label>
        <textarea
          id="note_bn"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
          placeholder="যেমন: গোয়ালঘর ও প্যাকিং শেড — সেখানে বিদ্যুৎ ও ইন্টারনেট আছে"
          maxLength={300}
        />
      </div>

      {!hasFarm && (
        <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-200">
          আপনার খামার এখনো ডাটাবেসে যুক্ত হয়নি — রিকোয়েস্ট পাঠালে আমাদের টিম খামারের তথ্য যোগ করবে।
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {saving ? "পাঠানো হচ্ছে…" : "রিকোয়েস্ট পাঠান"}
      </button>
    </form>
  );
}
