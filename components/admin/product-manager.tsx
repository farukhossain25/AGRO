"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, ImagePlus, Plus, Search, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { money, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";
import type { Product } from "@/lib/types";

type CategoryRef = { id: string; name_bn: string };

const emptyForm = {
  id: undefined as string | undefined,
  slug: "",
  category_id: "",
  name_bn: "",
  name_en: "",
  description_bn: "",
  unit: "কেজি",
  unit_en: "kg",
  price: 0,
  compare_price: null as number | null,
  stock: 0,
  image: "",
  farm_source_bn: "",
  harvest_date: "",
  badge_bn: "",
  is_featured: false,
  is_active: true,
};

type FormState = typeof emptyForm;

export function ProductManager({
  initial,
  categories,
  dbReady,
}: {
  initial: Product[];
  categories: CategoryRef[];
  dbReady: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [products, setProducts] = useState(initial);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name_bn.toLowerCase().includes(q) || p.name_en.toLowerCase().includes(q) || p.slug.includes(q)
    );
  }, [products, query]);

  function openNew() {
    setEditing({ ...emptyForm, category_id: categories[0]?.id ?? "" });
    setErrors({});
  }

  function openEdit(p: Product) {
    setEditing({
      id: p.id,
      slug: p.slug,
      category_id: p.category_id ?? "",
      name_bn: p.name_bn,
      name_en: p.name_en,
      description_bn: p.description_bn ?? "",
      unit: p.unit,
      unit_en: p.unit_en ?? "kg",
      price: Number(p.price),
      compare_price: p.compare_price ? Number(p.compare_price) : null,
      stock: p.stock,
      image: p.image ?? "",
      farm_source_bn: p.farm_source_bn ?? "",
      harvest_date: p.harvest_date ?? "",
      badge_bn: p.badge_bn ?? "",
      is_featured: p.is_featured,
      is_active: p.is_active,
    });
    setErrors({});
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/foisal/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "আপলোড ব্যর্থ");
      setEditing((f) => (f ? { ...f, image: json.data.url } : f));
      toast.success("ছবি আপলোড হয়েছে", json.data.url);
    } catch (err) {
      toast.error("আপলোড ব্যর্থ", (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch("/api/foisal/products", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        throw new Error(json.message ?? "সংরক্ষণ ব্যর্থ");
      }

      setProducts((prev) =>
        editing.id
          ? prev.map((p) => (p.id === editing.id ? { ...p, ...json.data } : p))
          : [json.data, ...prev]
      );
      toast.success(editing.id ? "পণ্য আপডেট হয়েছে" : "পণ্য যোগ হয়েছে", json.data.name_bn);
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast.error("সংরক্ষণ ব্যর্থ", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/foisal/products?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "মুছে ফেলা যায়নি");
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setConfirmDelete(null);
      toast.success("পণ্য মুছে ফেলা হয়েছে");
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">পণ্য ব্যবস্থাপনা</h1>
          <p className="text-[12px] text-sand-100/45">{toBn(products.length)}টি পণ্য</p>
        </div>
        <button onClick={openNew} className="btn-primary btn-sm" disabled={!dbReady}>
          <Plus className="h-4 w-4" /> নতুন পণ্য
        </button>
      </div>

      {!dbReady ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেস সংযুক্ত নেই — পড়া যাচ্ছে, কিন্তু সংরক্ষণ করা যাবে না।
        </p>
      ) : null}

      <label className="relative block max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="পণ্য খুঁজুন…"
          className="input !rounded-full !py-2.5 !pl-10 text-[12.5px]"
        />
      </label>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-sand-100/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">পণ্য</th>
                <th className="px-2 py-2.5 font-medium">দাম</th>
                <th className="px-2 py-2.5 font-medium">স্টক</th>
                <th className="px-2 py-2.5 font-medium">স্টেটাস</th>
                <th className="px-3 py-2.5 text-right font-medium">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                        {p.image ? <Image src={p.image} alt="" fill sizes="36px" className="object-cover" /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name_bn}</p>
                        <p className="truncate text-[9.5px] text-sand-100/30">{p.name_en}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {money(Number(p.price), true)}
                    <span className="text-[9.5px] text-sand-100/30">/{p.unit}</span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={p.stock <= 0 ? "text-red-300" : p.stock <= 10 ? "text-amber-300" : ""}>
                      {toBn(p.stock)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <span className={`badge !text-[9px] ${p.is_active ? "bg-leaf-600/20 text-leaf-700" : "bg-white/[0.07] text-sand-100/50"}`}>
                        {p.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                      </span>
                      {p.is_featured ? <span className="badge !text-[9px] bg-amber-500/15 text-amber-300">ফিচার্ড</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-sand-100/55 hover:bg-white/10 hover:text-sand-100" aria-label="এডিট">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {confirmDelete === p.id ? (
                        <span className="flex items-center gap-1">
                          <button onClick={() => remove(p.id)} className="rounded-lg bg-red-500/20 px-2 py-1 text-[10px] text-red-200">নিশ্চিত</button>
                          <button onClick={() => setConfirmDelete(null)} className="rounded-lg px-1.5 py-1 text-[10px] text-sand-100/50">না</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDelete(p.id)} className="rounded-lg p-1.5 text-sand-100/40 hover:bg-red-500/15 hover:text-red-300" aria-label="মুছুন">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? (
          <p className="py-10 text-center text-[12px] text-sand-100/40">কোনো পণ্য পাওয়া যায়নি</p>
        ) : null}
      </div>

      {/* editor modal */}
      {editing ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-3 backdrop-blur-sm sm:p-6">
          <form onSubmit={save} className="card my-4 w-full max-w-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold">{editing.id ? "পণ্য সম্পাদনা" : "নতুন পণ্য"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="বন্ধ">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">বাংলা নাম *</span>
                <input required value={editing.name_bn} onChange={(e) => setEditing({ ...editing, name_bn: e.target.value })} className="input" />
                {errors.name_bn ? <p className="mt-1 text-[11px] text-red-300">{errors.name_bn}</p> : null}
              </label>
              <label>
                <span className="label">English name *</span>
                <input required value={editing.name_en} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} className="input" />
                {errors.name_en ? <p className="mt-1 text-[11px] text-red-300">{errors.name_en}</p> : null}
              </label>
              <label>
                <span className="label">Slug * (ইংরেজি, হাইফেন)</span>
                <input
                  required
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  className="input font-mono text-[12px]"
                  placeholder="palong-shak"
                />
                {errors.slug ? <p className="mt-1 text-[11px] text-red-300">{errors.slug}</p> : null}
              </label>
              <label>
                <span className="label">ক্যাটাগরি *</span>
                <select required value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })} className="input">
                  <option value="">নির্বাচন করুন</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-ink-800">{c.name_bn}</option>
                  ))}
                </select>
                {errors.category_id ? <p className="mt-1 text-[11px] text-red-300">{errors.category_id}</p> : null}
              </label>

              <label>
                <span className="label">দাম (৳) *</span>
                <input type="number" min={0} step="0.01" required value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="input" />
                {errors.price ? <p className="mt-1 text-[11px] text-red-300">{errors.price}</p> : null}
              </label>
              <label>
                <span className="label">আগের দাম (৳)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editing.compare_price ?? ""}
                  onChange={(e) => setEditing({ ...editing, compare_price: e.target.value ? Number(e.target.value) : null })}
                  className="input"
                  placeholder="ঐচ্ছিক"
                />
              </label>
              <label>
                <span className="label">স্টক *</span>
                <input type="number" min={0} required value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} className="input" />
                {errors.stock ? <p className="mt-1 text-[11px] text-red-300">{errors.stock}</p> : null}
              </label>
              <label>
                <span className="label">ইউনিট</span>
                <select value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className="input">
                  {["কেজি", "গ্রাম", "আঁটি", "ডজন", "পিস", "লিটার", "প্যাকেট", "বক্স"].map((u) => (
                    <option key={u} value={u} className="bg-ink-800">{u}</option>
                  ))}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="label">ছবি</span>
                <div className="flex gap-2">
                  <input
                    value={editing.image}
                    onChange={(e) => setEditing({ ...editing, image: e.target.value })}
                    className="input font-mono text-[11.5px]"
                    placeholder="/images/cat/vegetables.jpg অথবা https://…"
                  />
                  <label className="btn-ghost btn-sm shrink-0 cursor-pointer">
                    {uploading ? <Spinner /> : <ImagePlus className="h-4 w-4" />}
                    <span className="hidden sm:inline">আপলোড</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadImage(file);
                      }}
                    />
                  </label>
                </div>
                {editing.image ? (
                  <div className="relative mt-2 h-20 w-28 overflow-hidden rounded-lg bg-ink-800">
                    <Image src={editing.image} alt="" fill sizes="112px" className="object-cover" />
                  </div>
                ) : null}
              </label>

              <label>
                <span className="label">খামার / সোর্স</span>
                <input value={editing.farm_source_bn} onChange={(e) => setEditing({ ...editing, farm_source_bn: e.target.value })} className="input" placeholder="সাভার, ঢাকা" />
              </label>
              <label>
                <span className="label">তোলার তারিখ</span>
                <input type="date" value={editing.harvest_date ?? ""} onChange={(e) => setEditing({ ...editing, harvest_date: e.target.value })} className="input" />
              </label>
              <label>
                <span className="label">ব্যাজ</span>
                <input value={editing.badge_bn} onChange={(e) => setEditing({ ...editing, badge_bn: e.target.value })} className="input" placeholder="তাজা / অর্গানিক" />
              </label>
              <label className="sm:col-span-2">
                <span className="label">বিবরণ</span>
                <textarea rows={3} value={editing.description_bn} onChange={(e) => setEditing({ ...editing, description_bn: e.target.value })} className="input resize-none" />
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} className="h-4 w-4 rounded border-white/20 bg-ink-800 accent-leaf-500" />
                <span className="text-[12.5px] text-sand-100/70">হোমপেজে ফিচার করুন</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="h-4 w-4 rounded border-white/20 bg-ink-800 accent-leaf-500" />
                <span className="text-[12.5px] text-sand-100/70">সক্রিয় (সাইটে দেখাবে)</span>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? <Spinner /> : null}
                সংরক্ষণ করুন
              </button>
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost">বাতিল</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
