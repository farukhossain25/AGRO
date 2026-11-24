"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/lib/toast";
import { AnnouncementMarquee } from "@/components/announcement-marquee";
import {
  defaultAnnouncementSettings,
  type AnnouncementSettings,
} from "@/lib/site-settings";

/* ==========================================================================
   AnnouncementEditor — /foisal/settings → "উপরের ঘোষণা"
   --------------------------------------------------------------------------
   Everything the marquee above the header shows is edited here: on/off, the
   Bangla and English message lists, the loop speed, an optional CTA link and
   whether the strip appears on phones. A live preview renders the real
   component, so the owner sees the result before saving.

   Saved through the same /api/foisal/settings PATCH as every other group, so
   it lands in the audit log like any other setting.
   ========================================================================== */

const MAX_MESSAGES = 8;

function toSettings(raw: Record<string, unknown> | undefined): AnnouncementSettings {
  const list = (value: unknown, fallback: string[]) =>
    Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
      : fallback;
  const text = (value: unknown, fallback: string) =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;

  const d = defaultAnnouncementSettings;
  return {
    enabled: typeof raw?.enabled === "boolean" ? raw.enabled : d.enabled,
    messages_bn: list(raw?.messages_bn, d.messages_bn),
    messages_en: list(raw?.messages_en, d.messages_en),
    speed: typeof raw?.speed === "number" ? raw.speed : d.speed,
    link_url: text(raw?.link_url, ""),
    link_label_bn: text(raw?.link_label_bn, ""),
    link_label_en: text(raw?.link_label_en, ""),
    show_mobile: typeof raw?.show_mobile === "boolean" ? raw.show_mobile : d.show_mobile,
  };
}

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`block space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[11.5px] font-semibold text-sand-100/70">{label}</span>
      {children}
      {hint ? <span className="block text-[10.5px] leading-relaxed text-sand-100/35">{hint}</span> : null}
    </label>
  );
}

function MessageList({
  title,
  values,
  onChange,
  dir,
}: {
  title: string;
  values: string[];
  onChange: (next: string[]) => void;
  dir: "bn" | "en";
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-sand-100/70">{title}</p>
        <span className="text-[10px] text-sand-100/35">
          {values.length}/{MAX_MESSAGES}
        </span>
      </div>

      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-center text-[10.5px] text-sand-100/30">{index + 1}</span>
            <input
              value={value}
              onChange={(e) => onChange(values.map((v, i) => (i === index ? e.target.value : v)))}
              placeholder={dir === "bn" ? "ঘোষণার লেখা…" : "Announcement text…"}
              className="input flex-1 !py-2 !text-[13px]"
              lang={dir}
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sand-100/40 transition hover:bg-red-500/15 hover:text-red-300"
              aria-label="মুছুন"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {values.length < MAX_MESSAGES ? (
        <button
          type="button"
          onClick={() => onChange([...values, ""])}
          className="btn-ghost mt-2 w-full !py-2 !text-[11.5px]"
        >
          <Plus className="h-3.5 w-3.5" /> নতুন লাইন
        </button>
      ) : null}
    </div>
  );
}

export function AnnouncementEditor({ initial }: { initial?: Record<string, unknown> }) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [draft, setDraft] = useState<AnnouncementSettings>(() => toSettings(initial));
  const [busy, setBusy] = useState(false);

  const patch = <K extends keyof AnnouncementSettings>(key: K, value: AnnouncementSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /* The preview must show what will actually ship — empty lines are dropped by
     the reader, so they are dropped here too. */
  const preview = useMemo<AnnouncementSettings>(
    () => ({
      ...draft,
      messages_bn: draft.messages_bn.map((m) => m.trim()).filter(Boolean),
      messages_en: draft.messages_en.map((m) => m.trim()).filter(Boolean),
    }),
    [draft]
  );

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/foisal/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: "announcement",
          value: {
            enabled: draft.enabled,
            show_mobile: draft.show_mobile,
            speed: Number(draft.speed),
            messages_bn: draft.messages_bn.map((m) => m.trim()).filter(Boolean),
            messages_en: draft.messages_en.map((m) => m.trim()).filter(Boolean),
            link_url: draft.link_url.trim(),
            link_label_bn: draft.link_label_bn.trim(),
            link_label_en: draft.link_label_en.trim(),
          },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        errorToast("সেভ হয়নি", json?.message ?? "আবার চেষ্টা করুন");
        return;
      }
      success("সেভ হয়েছে", "মার্কি এখনই সাইটে বদলে গেছে");
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <Megaphone className="h-4 w-4 text-leaf-300" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-bold">উপরের ঘোষণা (মার্কি)</h2>
          <p className="text-[10.5px] text-sand-100/40">
            সাইটের একদম উপরে চলমান লেখা — লেখা, গতি ও লিঙ্ক এখান থেকেই বদলাবে।
          </p>
        </div>
        <span className="badge ml-auto bg-leaf-600/20 text-leaf-700">
          {draft.enabled ? "চালু" : "বন্ধ"}
        </span>
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {/* live preview */}
        <div className="overflow-hidden rounded-xl border border-white/[0.07]">
          <p className="flex items-center gap-1.5 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sand-100/40">
            <Eye className="h-3 w-3" /> লাইভ প্রিভিউ
          </p>
          {preview.enabled && preview.messages_bn.length ? (
            <AnnouncementMarquee settings={preview} />
          ) : (
            <p className="px-3 py-4 text-center text-[11.5px] text-sand-100/35">
              বন্ধ আছে — অথবা কোনো লেখা নেই। চালু করলে এখানেই দেখা যাবে।
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <span className="text-[12px] font-semibold text-sand-100/80">মার্কি দেখাবে</span>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => patch("enabled", e.target.checked)}
              className="h-5 w-5 accent-leaf-500"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <span className="text-[12px] font-semibold text-sand-100/80">মোবাইলেও দেখাবে</span>
            <input
              type="checkbox"
              checked={draft.show_mobile}
              onChange={(e) => patch("show_mobile", e.target.checked)}
              className="h-5 w-5 accent-leaf-500"
            />
          </label>

          <Field
            label="একবার ঘুরতে কত সেকেন্ড (কম = দ্রুত)"
            hint="৮–১২০ সেকেন্ড। বড় সংখ্যা মানে ধীর গতি।"
          >
            <input
              type="number"
              min={8}
              max={120}
              step={1}
              value={draft.speed}
              onChange={(e) => patch("speed", Number(e.target.value) || 38)}
              className="input !py-2 !text-[13px]"
            />
          </Field>

          <Field label="লিঙ্ক (ঐচ্ছিক)" hint="উদাহরণ: /products?sort=newest অথবা https://…">
            <input
              value={draft.link_url}
              onChange={(e) => patch("link_url", e.target.value)}
              placeholder="/products"
              className="input !py-2 !text-[13px]"
              inputMode="url"
            />
          </Field>

          <Field label="লিঙ্কের লেখা (বাংলা)">
            <input
              value={draft.link_label_bn}
              onChange={(e) => patch("link_label_bn", e.target.value)}
              placeholder="নতুন পণ্য দেখুন"
              className="input !py-2 !text-[13px]"
            />
          </Field>

          <Field label="লিঙ্কের লেখা (English)">
            <input
              value={draft.link_label_en}
              onChange={(e) => patch("link_label_en", e.target.value)}
              placeholder="See what's new"
              className="input !py-2 !text-[13px]"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MessageList
            title="বাংলা লাইনগুলো"
            dir="bn"
            values={draft.messages_bn}
            onChange={(next) => patch("messages_bn", next)}
          />
          <MessageList
            title="English lines"
            dir="en"
            values={draft.messages_en}
            onChange={(next) => patch("messages_en", next)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={busy} className="btn-primary !py-2.5">
            <Save className="h-4 w-4" /> {busy ? "সেভ হচ্ছে…" : "সেভ করুন"}
          </button>
          <button
            type="button"
            onClick={() => setDraft(defaultAnnouncementSettings)}
            className="btn-ghost !py-2.5"
          >
            ডিফল্ট লেখা ফিরিয়ে আনুন
          </button>
          <p className="text-[10.5px] text-sand-100/35">সেভের পর সাইট রিলোড করলেই দেখবেন।</p>
        </div>
      </div>
    </section>
  );
}
