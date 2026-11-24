"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui";
import { SOCIAL_ICON_OPTIONS, SOCIAL_PLATFORMS } from "@/lib/content";
import type { SocialLink } from "@/lib/types";

/* ==========================================================================
   SocialManager — the icons in the header, footer and contact page
   --------------------------------------------------------------------------
   `platform` is the machine value (used for the accessible label), `icon` is
   the lucide name. Both are constrained: the renderer resolves icons through a
   fixed allow-list (SOCIAL_ICON_OPTIONS), so a typo degrades to a globe rather
   than crashing the header.

   Placement toggles are per-surface and independent — YouTube in the footer but
   not the header is a normal choice.
   ========================================================================== */

type Draft = Partial<SocialLink> & { id?: string };

const EMPTY: Draft = {
  platform: "facebook",
  label_bn: "",
  url: "https://",
  icon: "Facebook",
  sort_order: 0,
  is_active: true,
  show_header: false,
  show_footer: true,
  show_contact: true,
};

export function SocialManager({ initial }: { initial: SocialLink[] }) {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<SocialLink[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function open(row?: SocialLink) {
    setDraft(row ? { ...row } : { ...EMPTY, sort_order: (rows.at(-1)?.sort_order ?? 0) + 10 });
    setErrors({});
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setErrors({});

    try {
      const isEdit = Boolean(draft.id);
      const res = await fetch("/api/foisal/content/social", {
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
          ? prev.map((r) => (r.id === draft.id ? (json.data as SocialLink) : r))
          : [...prev, json.data as SocialLink].sort((a, b) => a.sort_order - b.sort_order)
      );
      toast.success(isEdit ? "আপডেট হয়েছে" : "যোগ হয়েছে", "হেডার/ফুটারে সাথে সাথে দেখা যাবে");
      setDraft(null);
      router.refresh();
    } catch (error) {
      toast.error("সংরক্ষণ হয়নি", (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function move(row: SocialLink, direction: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((r) => r.id === row.id);
    const target = sorted[index + direction];
    if (!target) return;

    const next = sorted.map((r) => {
      if (r.id === row.id) return { ...r, sort_order: target.sort_order };
      if (r.id === target.id) return { ...r, sort_order: row.sort_order };
      return r;
    });
    setRows(next.sort((a, b) => a.sort_order - b.sort_order));

    await Promise.all([
      fetch("/api/foisal/content/social", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...row, sort_order: target.sort_order }),
      }),
      fetch("/api/foisal/content/social", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, sort_order: row.sort_order }),
      }),
    ]);
    router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/foisal/content/social?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("মুছে ফেলা হয়েছে");
      router.refresh();
    } else {
      toast.error("মুছে ফেলা যায়নি");
    }
  }

  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">সোশ্যাল লিংক</h1>
          <p className="mt-0.5 text-[11.5px] text-sand-100/45">
            হেডার, ফুটার ও যোগাযোগ পেজে দেখানো হবে — কোনটি কোথায় দেখাবে আপনি ঠিক করবেন
          </p>
        </div>
        <button onClick={() => open()} className="btn-primary min-h-[40px] rounded-xl px-4 text-[13px]">
          <Plus className="h-4 w-4" /> নতুন লিংক
        </button>
      </div>

      <ul className="space-y-2">
        {sorted.map((row, index) => (
          <li key={row.id} className={`card flex flex-wrap items-center gap-3 p-2.5 ${row.is_active ? "" : "opacity-50"}`}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[11px] font-bold uppercase text-leaf-200">
              {row.platform.slice(0, 2)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold">
                {row.label_bn ?? row.platform}
                <span className="ml-1.5 font-mono text-[9.5px] font-normal text-sand-100/30">{row.platform}</span>
              </p>
              <p className="truncate font-mono text-[10px] text-sand-100/35">{row.url}</p>
              <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
                {row.show_header ? <Chip>হেডার</Chip> : null}
                {row.show_footer ? <Chip>ফুটার</Chip> : null}
                {row.show_contact ? <Chip>যোগাযোগ</Chip> : null}
                {!row.is_active ? <Chip tone="red">বন্ধ</Chip> : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => move(row, -1)} disabled={index === 0} className="rounded-lg p-1.5 text-sand-100/40 hover:bg-white/10 disabled:opacity-20" aria-label="উপরে">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => move(row, 1)} disabled={index === sorted.length - 1} className="rounded-lg p-1.5 text-sand-100/40 hover:bg-white/10 disabled:opacity-20" aria-label="নিচে">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => open(row)} className="rounded-lg p-1.5 text-sand-100/40 hover:bg-white/10 hover:text-sand-100" aria-label="সম্পাদনা">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => remove(row.id)} className="rounded-lg p-1.5 text-sand-100/30 hover:bg-red-500/15 hover:text-red-300" aria-label="মুছুন">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {draft ? (
        <div className="fixed inset-0 z-[96]">
          <button className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => setDraft(null)} aria-label="বন্ধ" />
          <form onSubmit={save} className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/85 bg-neu-surface shadow-neu-lg">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-[13.5px] font-bold">{draft.id ? "লিংক সম্পাদনা" : "নতুন সোশ্যাল লিংক"}</h2>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1.5 text-sand-100/50 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <label className="block space-y-1">
                <span className="text-[11.5px] font-medium text-sand-100/70">প্ল্যাটফর্ম</span>
                <select
                  className="inp"
                  value={draft.platform ?? "facebook"}
                  onChange={(e) => {
                    const platform = SOCIAL_PLATFORMS.find((p) => p.value === e.target.value);
                    set("platform", e.target.value);
                    if (platform) set("icon", platform.icon);
                  }}
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[11.5px] font-medium text-sand-100/70">দেখানোর নাম (ঐচ্ছিক)</span>
                <input className="inp" value={draft.label_bn ?? ""} onChange={(e) => set("label_bn", e.target.value)} placeholder="ফেসবুক" />
              </label>

              <label className="block space-y-1">
                <span className="text-[11.5px] font-medium text-sand-100/70">
                  লিংক <span className="text-red-300">*</span>
                </span>
                <input
                  className="inp font-mono text-[11px]"
                  value={draft.url ?? ""}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://facebook.com/yourpage"
                />
                {errors.url ? <span className="block text-[10.5px] text-red-300">{errors.url}</span> : null}
              </label>

              <label className="block space-y-1">
                <span className="text-[11.5px] font-medium text-sand-100/70">আইকন</span>
                <select className="inp" value={draft.icon ?? "Globe"} onChange={(e) => set("icon", e.target.value)}>
                  {SOCIAL_ICON_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1.5 rounded-xl bg-white/[0.03] p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sand-100/35">কোথায় দেখাবে</p>
                <Check label="হেডারে" checked={Boolean(draft.show_header)} onChange={(v) => set("show_header", v)} />
                <Check label="ফুটারে" checked={Boolean(draft.show_footer)} onChange={(v) => set("show_footer", v)} />
                <Check label="যোগাযোগ পেজে" checked={Boolean(draft.show_contact)} onChange={(v) => set("show_contact", v)} />
                <Check label="সক্রিয়" checked={Boolean(draft.is_active)} onChange={(v) => set("is_active", v)} />
              </div>

              <label className="block space-y-1">
                <span className="text-[11.5px] font-medium text-sand-100/70">ক্রম</span>
                <input className="inp" type="number" value={draft.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} />
              </label>
            </div>

            <div className="flex gap-2 border-t border-white/[0.06] px-4 py-3">
              <button type="button" onClick={() => setDraft(null)} className="btn-ghost flex-1 rounded-xl text-[12.5px]">
                বাতিল
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 rounded-xl text-[12.5px]">
                {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} সংরক্ষণ
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "red" }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 font-medium ${
        tone === "red" ? "bg-red-500/15 text-red-300" : "bg-leaf-600/15 text-leaf-700"
      }`}
    >
      {children}
    </span>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11.5px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-leaf-500" />
      {label}
    </label>
  );
}
