"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { money, toBn } from "@/lib/format";
import type { Product } from "@/lib/types";

type Category = { id: string; name_bn: string };
type Row = Product & { approval_status?: string; approval_note?: string | null };

const empty = {
  category_id: "",
  name_bn: "",
  name_en: "",
  description_bn: "",
  unit: "কেজি",
  unit_en: "kg",
  price: "",
  compare_price: "",
  stock: "",
  image: "",
};

/* ==========================================================================
   SellerProductManager — seller-side product CRUD with approval queue
   ========================================================================== */

export function SellerProductManager({
  initial,
  categories,
  canAdd,
}: {
  initial: Row[];
  categories: Category[];
  canAdd: boolean;
}) {
  const { success, error: errorToast } = useToast();
  const [rows, setRows] = useState<Row[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, category_id: categories[0]?.id ?? "" });
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      category_id: row.category_id ?? "",
      name_bn: row.name_bn ?? "",
      name_en: row.name_en ?? "",
      description_bn: row.description_bn ?? "",
      unit: row.unit ?? "কেজি",
      unit_en: row.unit_en ?? "kg",
      price: String(row.price ?? ""),
      compare_price: row.compare_price ? String(row.compare_price) : "",
      stock: String(row.stock ?? 0),
      image: row.image ?? row.images?.[0] ?? "",
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        compare_price: form.compare_price ? Number(form.compare_price) : null,
        stock: Number(form.stock || 0),
      };

      const res = await fetch("/api/sellers/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing ? { ...payload, id: editing.id } : payload),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("সেভ হয়নি", json?.message);
        return;
      }

      const saved = json.data.product ?? json.data;
      setRows((prev) =>
        editing ? prev.map((r) => (r.id === editing.id ? { ...r, ...saved } : r)) : [saved, ...prev]
      );
      const live = (json.data?.product ?? json.data)?.approval_status === "approved";
      success(
        editing ? "পণ্য আপডেট হয়েছে" : "পণ্য যোগ হয়েছে",
        live ? "এখনই আপনার স্টোর ও মেইন সাইটে দেখা যাচ্ছে" : "অ্যাডমিন অনুমোদনের অপেক্ষায়"
      );
      setOpen(false);
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`"${row.name_bn}" মুছে ফেলবেন?`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch("/api/sellers/products", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        errorToast("মুছা যায়নি", json?.message);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      success("পণ্য মুছে ফেলা হয়েছে");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (row: Row) => {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/sellers/products", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, is_active: !row.is_active }),
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...json.data } : r)));
      }
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = rows.filter((r) => r.approval_status === "pending").length;

  return (
    <div>
      {/* Live count: lives here, not in the server-rendered heading, so it
          updates the moment a product is added or deleted. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11.5px] text-sand-100/50">
          {toBn(rows.length)}টি পণ্য{pendingCount ? ` · ${toBn(pendingCount)}টি যাচাইয়ের অপেক্ষায়` : ""}
        </p>
        {canAdd && (
          <button type="button" onClick={openNew} className="btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" /> নতুন পণ্য
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="card border-dashed p-8 text-center">
          <p className="text-[13px] text-sand-100/55">এখনো কোনো পণ্য যোগ করা হয়নি</p>
          {canAdd && (
            <button type="button" onClick={openNew} className="btn-ghost btn-sm mt-3">
              প্রথম পণ্য যোগ করুন
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="card flex items-center gap-3 p-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                {row.image || row.images?.[0] ? (
                  <Image
                    src={row.image ?? row.images![0]}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-lg">🥬</div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-semibold text-neu-ink">{row.name_bn}</p>
                  {row.approval_status === "pending" && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-300">
                      যাচাই
                    </span>
                  )}
                  {row.approval_status === "rejected" && (
                    <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-red-300">
                      বাতিল
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-sand-100/45">
                  {money(Number(row.price), true)} / {row.unit} · স্টক {toBn(row.stock)}
                  {row.is_active ? "" : " · নিষ্ক্রিয়"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleActive(row)}
                  disabled={busyId === row.id}
                  className="rounded-lg px-2 py-1 text-[10.5px] text-sand-100/55 hover:bg-white/6 disabled:opacity-40"
                >
                  {row.is_active ? "লুকান" : "দেখান"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="rounded-lg p-1.5 text-sand-100/55 hover:bg-white/6"
                  aria-label="এডিট"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(row)}
                  disabled={busyId === row.id}
                  className="rounded-lg p-1.5 text-red-300/70 hover:bg-red-500/10 disabled:opacity-40"
                  aria-label="মুছুন"
                >
                  {busyId === row.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-3 backdrop-blur-sm sm:p-6">
          <form onSubmit={save} className="card my-6 w-full max-w-lg p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-neu-ink">{editing ? "পণ্য এডিট" : "নতুন পণ্য"}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="বন্ধ">
                <X className="h-4 w-4 text-sand-100/50" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">বাংলা নাম *</label>
                <input
                  required
                  value={form.name_bn}
                  onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">English name *</label>
                <input
                  required
                  value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                  className="input"
                  placeholder="Fresh Spinach"
                />
              </div>
              <div>
                <label className="label">ক্যাটাগরি *</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">নির্বাচন করুন</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_bn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">একক</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="input"
                  placeholder="কেজি / ডজন / লিটার"
                />
              </div>
              <div>
                <label className="label">দাম (৳) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">আগের দাম (ঐচ্ছিক)</label>
                <input
                  type="number"
                  min="0"
                  value={form.compare_price}
                  onChange={(e) => setForm({ ...form, compare_price: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">স্টক *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">ছবির URL</label>
                <input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  className="input"
                  placeholder="/images/cat/vegetables.jpg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">বিবরণ</label>
                <textarea
                  rows={3}
                  value={form.description_bn}
                  onChange={(e) => setForm({ ...form, description_bn: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <p className="mt-3 text-[10.5px] text-sand-100/35">
              নতুন পণ্য ও দাম পরিবর্তন অ্যাডমিন অনুমোদনের পর গ্রাহকের কাছে দেখা যাবে।
            </p>

            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "সেভ হচ্ছে…" : "সেভ করুন"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                বাতিল
              </button>
            </div>
          </form>
        </div>
      )}

      {!canAdd && (
        <p className="mt-3 text-[11px] text-sand-100/35">
          অনুমোদনের পর পণ্য যোগ করতে পারবেন।{" "}
          <Link href="/contact" className="text-mint hover:underline">
            সাহায্য দরকার?
          </Link>
        </p>
      )}
    </div>
  );
}
