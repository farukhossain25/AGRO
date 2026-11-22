"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImageIcon,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui";
import { ImageField } from "./image-field";
import type { HeroSlide } from "@/lib/types";

/* ==========================================================================
   SlideManager — the homepage carousel, controlled from /foisal/slides
   --------------------------------------------------------------------------
   Separate desktop and mobile art is the point of `image_mobile_url`: a 1920px
   hero is ~3× the bytes a phone needs, and it is the LCP element. When the
   mobile field is empty the desktop image is reused, so a half-filled slide is
   still valid.

   Scheduling (`starts_at`/`ends_at`) is checked in three places — the query in
   lib/content.ts, the RLS policy, and here — because an out-of-season offer
   slide is worse than no slide.
   ========================================================================== */

type Draft = Partial<HeroSlide> & { id?: string };

const EMPTY: Draft = {
  title_bn: "",
  subtitle_bn: "",
  image_url: "",
  image_mobile_url: "",
  video_url: "",
  alt_bn: "",
  cta_label_bn: "",
  cta_href: "/products",
  secondary_label_bn: "",
  secondary_href: "",
  text_position: "left",
  text_tone: "light",
  overlay_opacity: 45,
  starts_at: "",
  ends_at: "",
  sort_order: 0,
  is_active: true,
};

export function SlideManager({ initial }: { initial: HeroSlide[] }) {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<HeroSlide[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function open(row?: HeroSlide) {
    setDraft(
      row
        ? {
            ...row,
            starts_at: row.starts_at ? row.starts_at.slice(0, 16) : "",
            ends_at: row.ends_at ? row.ends_at.slice(0, 16) : "",
          }
        : { ...EMPTY, sort_order: (rows.at(-1)?.sort_order ?? 0) + 10 }
    );
    setErrors({});
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;

    if (!draft.image_url && !draft.video_url) {
      setErrors({ image_url: "ছবি অথবা ভিডিও — অন্তত একটি দিন" });
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const isEdit = Boolean(draft.id);
      const res = await fetch("/api/foisal/content/hero", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        throw new Error(json.message ?? "সংরক্ষণ ব্যর্থ");
      }

      setRows((prev) =>
        isEdit
          ? prev.map((r) => (r.id === draft.id ? (json.data as HeroSlide) : r))
          : [...prev, json.data as HeroSlide].sort((a, b) => a.sort_order - b.sort_order)
      );
      toast.success(isEdit ? "স্লাইড আপডেট হয়েছে" : "নতুন স্লাইড যোগ হয়েছে", "হোমপেজে সাথে সাথে দেখা যাবে");
      setDraft(null);
      router.refresh();
    } catch (error) {
      toast.error("সংরক্ষণ হয়নি", (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function reorder(list: HeroSlide[]) {
    setRows(list);
    await fetch("/api/foisal/content/hero", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: list.map((r, i) => ({ id: r.id, sort_order: (i + 1) * 10 })) }),
    });
    router.refresh();
  }

  function move(row: HeroSlide, direction: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((r) => r.id === row.id);
    const target = sorted[index + direction];
    if (!target) return;
    const next = sorted.map((r) => {
      if (r.id === row.id) return { ...r, sort_order: target.sort_order };
      if (r.id === target.id) return { ...r, sort_order: row.sort_order };
      return r;
    });
    void reorder(next);
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/foisal/content/hero?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "মুছে ফেলা যায়নি");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setConfirmId(null);
      toast.success("স্লাইড মুছে ফেলা হয়েছে");
      router.refresh();
    } catch (error) {
      toast.error("ব্যর্থ", (error as Error).message);
    }
  }

  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">হোমপেজ স্লাইডার</h1>
          <p className="mt-0.5 text-[11.5px] text-sand-100/45">
            হেডারের ঠিক নিচের ক্যারোসেল — ক্রম বদলান, তারিখ দিন, চালু/বন্ধ করুন
          </p>
        </div>
        <button onClick={() => open()} className="btn-primary min-h-[40px] rounded-xl px-4 text-[13px]">
          <Plus className="h-4 w-4" /> নতুন স্লাইড
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="card grid place-items-center py-14 text-center">
          <ImageIcon className="mb-2 h-8 w-8 text-sand-100/25" />
          <p className="text-[13px] font-semibold">এখনো কোনো স্লাইড নেই</p>
          <p className="mt-0.5 text-[11.5px] text-sand-100/40">
            ডিফল্ট স্লাইড দেখানো হচ্ছে — যোগ করলে সেটি বদলে যাবে
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((row, index) => (
            <li key={row.id} className={`card flex flex-wrap items-center gap-3 p-2.5 ${row.is_active ? "" : "opacity-55"}`}>
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                {row.image_url ? (
                  <Image src={row.image_url} alt="" fill sizes="112px" className="object-cover" />
                ) : (
                  <span className="grid h-full place-items-center text-[9px] text-sand-100/30">ভিডিও</span>
                )}
                <span className="absolute left-1 top-1 rounded bg-ink-950/70 px-1 text-[9px] font-bold text-sand-100/80">
                  {index + 1}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{row.title_bn}</p>
                <p className="truncate text-[11px] text-sand-100/40">{row.subtitle_bn ?? "—"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9.5px] text-sand-100/40">
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5">
                    {row.text_position === "left" ? "বাঁয়ে" : row.text_position === "right" ? "ডানে" : "মাঝে"}
                  </span>
                  {row.image_mobile_url ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-leaf-600/15 px-1.5 py-0.5 text-leaf-200">
                      <Smartphone className="h-2.5 w-2.5" /> মোবাইল ছবি
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5">
                      <Monitor className="h-2.5 w-2.5" /> ডেস্কটপ ছবি
                    </span>
                  )}
                  {row.starts_at || row.ends_at ? (
                    <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-sky-300">সময়সূচি</span>
                  ) : null}
                  {!row.is_active ? (
                    <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-red-300">বন্ধ</span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => move(row, -1)} disabled={index === 0} className="rounded-lg p-1.5 text-sand-100/40 hover:bg-white/10 disabled:opacity-20" aria-label="উপরে">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(row, 1)} disabled={index === sorted.length - 1} className="rounded-lg p-1.5 text-sand-100/40 hover:bg-white/10 disabled:opacity-20" aria-label="নিচে">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setDraft({ ...row });
                    void (async () => {
                      await fetch("/api/foisal/content/hero", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...row, is_active: !row.is_active }),
                      });
                      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !row.is_active } : r)));
                      setDraft(null);
                      router.refresh();
                    })();
                  }}
                  className={`rounded-lg p-1.5 hover:bg-white/10 ${row.is_active ? "text-leaf-300" : "text-sand-100/30"}`}
                  aria-label={row.is_active ? "বন্ধ করুন" : "চালু করুন"}
                >
                  {row.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => open(row)} className="rounded-lg bg-white/[0.07] px-2 py-1.5 text-[11px] hover:bg-white/[0.12]">
                  সম্পাদনা
                </button>
                <button onClick={() => setConfirmId(row.id)} className="rounded-lg p-1.5 text-sand-100/30 hover:bg-red-500/15 hover:text-red-300" aria-label="মুছুন">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {confirmId === row.id ? (
                <div className="flex w-full items-center justify-between gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-[11.5px]">
                  <span>স্লাইডটি মুছে ফেলবেন?</span>
                  <span className="flex gap-1.5">
                    <button onClick={() => remove(row.id)} className="rounded-lg bg-red-500/25 px-2 py-1 font-semibold text-red-200">হ্যাঁ</button>
                    <button onClick={() => setConfirmId(null)} className="rounded-lg bg-white/10 px-2 py-1">না</button>
                  </span>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <div className="fixed inset-0 z-[96]">
          <button className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => setDraft(null)} aria-label="বন্ধ" />
          <form onSubmit={save} className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-white/10 bg-ink-900">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-[14px] font-bold">{draft.id ? "স্লাইড সম্পাদনা" : "নতুন স্লাইড"}</h2>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1.5 text-sand-100/50 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <Field label="শিরোনাম" error={errors.title_bn} required>
                <input className="inp" value={draft.title_bn ?? ""} onChange={(e) => set("title_bn", e.target.value)} />
              </Field>

              <Field label="সাবটেক্সট">
                <textarea className="inp min-h-[56px]" value={draft.subtitle_bn ?? ""} onChange={(e) => set("subtitle_bn", e.target.value)} />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <ImageField
                  label="ডেস্কটপ ছবি"
                  value={draft.image_url ?? ""}
                  onChange={(url) => set("image_url", url)}
                  bucket="hero-slides"
                  hint="১৫০০×৭০০ এর কাছাকাছি হলে সবচেয়ে ভালো"
                />
                <ImageField
                  label="মোবাইল ছবি (ঐচ্ছিক)"
                  value={draft.image_mobile_url ?? ""}
                  onChange={(url) => set("image_mobile_url", url)}
                  bucket="hero-slides"
                  ratio="square"
                  hint="খালি রাখলে ডেস্কটপ ছবিই ব্যবহৃত হবে"
                />
              </div>
              {errors.image_url ? <p className="text-[11px] text-red-300">{errors.image_url}</p> : null}

              <Field label="ভিডিও URL (ঐচ্ছিক)" hint="mp4 লিংক — ছবির বদলে চলবে">
                <input className="inp font-mono text-[11px]" value={draft.video_url ?? ""} onChange={(e) => set("video_url", e.target.value)} placeholder="https://…/slide.mp4" />
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="বাটন লেখা">
                  <input className="inp" value={draft.cta_label_bn ?? ""} onChange={(e) => set("cta_label_bn", e.target.value)} placeholder="এখনই অর্ডার করুন" />
                </Field>
                <Field label="বাটন লিংক">
                  <input className="inp font-mono text-[11px]" value={draft.cta_href ?? ""} onChange={(e) => set("cta_href", e.target.value)} placeholder="/products" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="২য় বাটন লেখা">
                  <input className="inp" value={draft.secondary_label_bn ?? ""} onChange={(e) => set("secondary_label_bn", e.target.value)} />
                </Field>
                <Field label="২য় বাটন লিংক">
                  <input className="inp font-mono text-[11px]" value={draft.secondary_href ?? ""} onChange={(e) => set("secondary_href", e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="লেখার অবস্থান">
                  <select className="inp" value={draft.text_position ?? "left"} onChange={(e) => set("text_position", e.target.value as HeroSlide["text_position"])}>
                    <option value="left">বাঁয়ে</option>
                    <option value="center">মাঝে</option>
                    <option value="right">ডানে</option>
                  </select>
                </Field>
                <Field label="লেখার রং">
                  <select className="inp" value={draft.text_tone ?? "light"} onChange={(e) => set("text_tone", e.target.value as HeroSlide["text_tone"])}>
                    <option value="light">সাদা (গাঢ় ছবির জন্য)</option>
                    <option value="dark">কালো (হালকা ছবির জন্য)</option>
                  </select>
                </Field>
              </div>

              <Field label={`অন্ধকার স্তর — ${draft.overlay_opacity ?? 45}%`} hint="লেখা পড়তে কষ্ট হলে বাড়ান">
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={draft.overlay_opacity ?? 45}
                  onChange={(e) => set("overlay_opacity", Number(e.target.value))}
                  className="w-full accent-leaf-500"
                />
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="শুরু (ঐচ্ছিক)">
                  <input className="inp" type="datetime-local" value={draft.starts_at ?? ""} onChange={(e) => set("starts_at", e.target.value)} />
                </Field>
                <Field label="শেষ (ঐচ্ছিক)">
                  <input className="inp" type="datetime-local" value={draft.ends_at ?? ""} onChange={(e) => set("ends_at", e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="ক্রম">
                  <input className="inp" type="number" value={draft.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} />
                </Field>
                <label className="flex items-end gap-2 pb-2 text-[11.5px]">
                  <input type="checkbox" checked={Boolean(draft.is_active)} onChange={(e) => set("is_active", e.target.checked)} className="h-3.5 w-3.5 accent-leaf-500" />
                  সাইটে চালু
                </label>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/[0.06] px-4 py-3">
              <button type="button" onClick={() => setDraft(null)} className="btn-ghost flex-1 rounded-xl text-[13px]">
                বাতিল
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 rounded-xl text-[13px]">
                {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} সংরক্ষণ
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  error,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11.5px] font-medium text-sand-100/70">
        {label}
        {required ? <span className="text-red-300"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-[10px] text-sand-100/35">{hint}</span> : null}
      {error ? <span className="block text-[10.5px] text-red-300">{error}</span> : null}
    </label>
  );
}
