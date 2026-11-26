"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  LayoutTemplate,
  Save,
  Settings2,
} from "lucide-react";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui";
import type { HomepageSection } from "@/lib/types";

/* ==========================================================================
   LayoutManager — drag-to-reorder homepage sections
   --------------------------------------------------------------------------
   Native HTML5 drag events, no library: the list is twelve items and a
   dependency would cost more in bundle weight than it saves in code (and the
   admin bundle is lazy-loaded, so it stays off the public pages either way).

   Up/down buttons are kept alongside the drag handle because drag-and-drop is
   unusable with a keyboard and awkward on a phone — the buttons are the
   accessible path, not a fallback.

   The whole order is saved in ONE request so a dropped connection cannot leave
   the homepage half-reordered.
   ========================================================================== */

type Row = HomepageSection & { _dirty?: boolean };

export function LayoutManager({ initial }: { initial: HomepageSection[] }) {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<Row[]>(() => [...initial].sort((a, b) => a.sort_order - b.sort_order));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);

  const visibleCount = useMemo(() => rows.filter((r) => r.is_visible).length, [rows]);

  function touch(next: Row[]) {
    // Renumber densely so sort_order stays 10, 20, 30… after any move.
    setRows(next.map((row, index) => ({ ...row, sort_order: (index + 1) * 10 })));
    setDirty(true);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    touch(next);
  }

  function drop() {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...rows];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(overIndex, 0, moved);
    touch(next);
    setDragIndex(null);
    setOverIndex(null);
  }

  function toggleVisible(index: number) {
    const next = [...rows];
    next[index] = { ...next[index], is_visible: !next[index].is_visible };
    touch(next);
  }

  function updateConfig(id: string, patch: Record<string, unknown>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, config: { ...row.config, ...patch } } : row))
    );
    setDirty(true);
    setEditing(null);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/foisal/homepage-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: rows.map((row) => ({
            id: row.id,
            is_visible: row.is_visible,
            sort_order: row.sort_order,
            config: row.config,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "সংরক্ষণ ব্যর্থ");

      toast.success("হোমপেজের ক্রম সেভ হয়েছে", "সাইটে সাথে সাথে প্রয়োগ হয়েছে");
      setDirty(false);
      router.refresh();
    } catch (error) {
      toast.error("সেভ হয়নি", (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">হোমপেজ সাজান</h1>
          <p className="mt-0.5 text-[11.5px] text-sand-100/45">
            টেনে উপরে-নিচে করুন · {visibleCount}টি সেকশন দেখানো হচ্ছে
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="btn-primary min-h-[40px] rounded-xl px-4 text-[13px] disabled:opacity-40"
        >
          {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {dirty ? "পরিবর্তন সেভ করুন" : "সেভ করা আছে"}
        </button>
      </div>

      <div className="card p-1.5">
        <ul className="space-y-1">
          {rows.map((row, index) => (
            <li
              key={row.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={drop}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={`flex items-center gap-2 rounded-xl px-2 py-2 transition ${
                dragIndex === index ? "opacity-40" : ""
              } ${overIndex === index && dragIndex !== index ? "ring-1 ring-leaf-500/60" : ""} ${
                row.is_visible ? "bg-white/[0.03]" : "bg-white/[0.015]"
              }`}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-sand-100/25 active:cursor-grabbing" />

              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[10px] font-bold text-sand-100/50">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-[12.5px] font-medium ${row.is_visible ? "" : "text-sand-100/40"}`}>
                  {row.label_bn}
                </p>
                <p className="truncate font-mono text-[9.5px] text-sand-100/25">{row.key}</p>
              </div>

              {Object.keys(row.config ?? {}).length > 0 ? (
                <button
                  onClick={() => setEditing(row)}
                  className="rounded-lg p-1.5 text-sand-100/35 hover:bg-white/10 hover:text-leaf-200"
                  aria-label="সেটিংস"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="w-[26px]" />
              )}

              <button
                onClick={() => toggleVisible(index)}
                className={`rounded-lg p-1.5 hover:bg-white/10 ${row.is_visible ? "text-leaf-300" : "text-sand-100/25"}`}
                aria-label={row.is_visible ? "লুকান" : "দেখান"}
              >
                {row.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>

              <div className="flex flex-col">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded p-0.5 text-sand-100/35 hover:text-sand-100 disabled:opacity-20"
                  aria-label="উপরে"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  className="rounded p-0.5 text-sand-100/35 hover:text-sand-100 disabled:opacity-20"
                  aria-label="নিচে"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="flex items-start gap-1.5 rounded-xl bg-white/[0.03] px-3 py-2 text-[10.5px] text-sand-100/40">
        <LayoutTemplate className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        হেডার সবসময় সবার উপরে এবং ফুটার সবার নিচে থাকে — সেগুলো এই তালিকায় নেই। স্লাইডার সেকশনটি হেডারের ঠিক
        নিচে রাখতে প্রথমে রাখুন।
      </p>

      {editing ? (
        <ConfigDrawer row={editing} onClose={() => setEditing(null)} onSave={updateConfig} />
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- config */

function ConfigDrawer({
  row,
  onClose,
  onSave,
}: {
  row: Row;
  onClose: () => void;
  onSave: (id: string, patch: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row.config ?? {})) {
      out[key] = typeof value === "string" ? value : String(value ?? "");
    }
    return out;
  });

  /* A small, per-section field map beats a generic JSON editor: the owner
     should never have to type JSON to change a heading. */
  const FIELDS: Record<string, { key: string; label: string; type: "text" | "long" | "number" }[]> = {
    hero_slider: [
      { key: "autoplay_ms", label: "অটো-স্লাইড (মিলিসেকেন্ড)", type: "number" },
    ],
    featured_products: [
      { key: "heading_bn", label: "শিরোনাম", type: "text" },
      { key: "limit", label: "কতটি পণ্য", type: "number" },
    ],
    text_block: [
      { key: "heading_bn", label: "শিরোনাম", type: "text" },
      { key: "body_bn", label: "লেখা", type: "long" },
    ],
    product_ring: [
      { key: "heading_bn", label: "শিরোনাম", type: "text" },
      { key: "limit", label: "চাকায় কতটি পণ্য (৬–২৪)", type: "number" },
      { key: "spin_speed", label: "এক পাকে কত সেকেন্ড (৬–১২০, কম = দ্রুত)", type: "number" },
      { key: "free_spin", label: "চাকা নিজে ঘোরে (১ = হ্যাঁ, ০ = শুধু টেনে)", type: "number" },
    ],
    reviews: [{ key: "limit", label: "কতটি রিভিউ", type: "number" }],
    blog: [{ key: "limit", label: "কতটি পোস্ট", type: "number" }],
    faq: [{ key: "limit", label: "কতটি প্রশ্ন", type: "number" }],
  };

  const fields = FIELDS[row.key] ?? [];

  return (
    <div className="fixed inset-0 z-[96]">
      <button className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} aria-label="বন্ধ" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/85 bg-neu-surface shadow-neu-lg">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[13.5px] font-bold">{row.label_bn} — সেটিংস</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sand-100/45 hover:bg-white/10">
            বন্ধ
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {fields.length === 0 ? (
            <p className="text-[11.5px] text-sand-100/40">এই সেকশনে বদলানোর মতো সেটিংস নেই।</p>
          ) : (
            fields.map((field) => (
              <label key={field.key} className="block space-y-1">
                <span className="text-[11.5px] font-medium text-sand-100/70">{field.label}</span>
                {field.type === "long" ? (
                  <textarea
                    className="inp min-h-[80px]"
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  />
                ) : (
                  <input
                    className="inp"
                    type={field.type === "number" ? "number" : "text"}
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  />
                )}
              </label>
            ))
          )}

          {/* The two numbers above are meaningless on their own ("১৮" what?),
              so the drawer says what they do to the wheel in plain words. */}
          {row.key === "product_ring" ? (
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10.5px] leading-relaxed text-sand-100/45">
              “এক পাক” কমালে চাকা দ্রুত ঘুরবে। গ্রাহক মাউস রাখলে বা ধরলে চাকা থেমে যায়,
              ছাড়লে আবার ঘোরে। “নিজে ঘোরে = ০” দিলে চাকা স্থির থাকবে, শুধু টেনে বা তীর
              চেপে ঘোরাতে হবে।
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-white/[0.06] px-4 py-3">
          <button onClick={onClose} className="btn-ghost flex-1 rounded-xl text-[12.5px]">
            বাতিল
          </button>
          <button
            onClick={() => {
              const patch: Record<string, unknown> = {};
              for (const field of fields) {
                const raw = values[field.key];
                if (field.key === "free_spin") {
                  /* 0 / 1 from the number box → a real boolean, because the
                     homepage renderer tests `config.free_spin !== false`. */
                  patch[field.key] = String(raw ?? "").trim() !== "0";
                  continue;
                }
                patch[field.key] = field.type === "number" ? Number(raw || 0) : raw;
              }
              onSave(row.id, patch);
            }}
            className="btn-primary flex-1 rounded-xl text-[12.5px]"
          >
            <Save className="h-3.5 w-3.5" /> প্রয়োগ
          </button>
        </div>
      </div>
    </div>
  );
}
