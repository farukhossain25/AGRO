"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui";

export type Field = {
  name: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "checkbox" | "date";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  colSpan?: 1 | 2;
};

export type Column = {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => React.ReactNode;
};

/**
 * Reusable admin CRUD table + modal form for the simpler entities
 * (categories, coupons, banners, blog, delivery zones).
 */
export function SimpleManager({
  title,
  subtitle,
  resource,
  initial,
  columns,
  fields,
  emptyRow,
  dbReady = true,
}: {
  title: string;
  subtitle?: string;
  resource: string;
  initial: Record<string, unknown>[];
  columns: Column[];
  fields: Field[];
  emptyRow: Record<string, unknown>;
  dbReady?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setErrors({});
    try {
      const isEdit = Boolean(form.id);
      const res = await fetch(`/api/admin/${resource}`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        throw new Error(json.message ?? "সংরক্ষণ ব্যর্থ");
      }
      setRows((prev) => (isEdit ? prev.map((r) => (r.id === form.id ? json.data : r)) : [json.data, ...prev]));
      toast.success(isEdit ? "আপডেট হয়েছে" : "যোগ হয়েছে");
      setForm(null);
      router.refresh();
    } catch (err) {
      toast.error("সংরক্ষণ ব্যর্থ", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/admin/${resource}?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "মুছে ফেলা যায়নি");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setConfirmId(null);
      toast.success("মুছে ফেলা হয়েছে");
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    }
  }

  function open(row: Record<string, unknown>) {
    setForm(structuredClone(row));
    setErrors({});
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle ? <p className="text-[12px] text-sand-100/45">{subtitle}</p> : null}
        </div>
        <button onClick={() => open(emptyRow)} className="btn-primary btn-sm" disabled={!dbReady}>
          <Plus className="h-4 w-4" /> নতুন
        </button>
      </div>

      {!dbReady ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেস সংযুক্ত নেই — শুধুমাত্র পড়া যাচ্ছে।
        </p>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-sand-100/40">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-2.5 font-medium">{c.label}</th>
                ))}
                <th className="px-3 py-2.5 text-right font-medium">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-white/[0.02]">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2.5">
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => open(row)} className="rounded-lg p-1.5 text-sand-100/55 hover:bg-white/10" aria-label="এডিট">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {confirmId === row.id ? (
                        <span className="flex items-center gap-1">
                          <button onClick={() => remove(String(row.id))} className="rounded-lg bg-red-500/20 px-2 py-1 text-[10px] text-red-200">নিশ্চিত</button>
                          <button onClick={() => setConfirmId(null)} className="px-1 text-[10px] text-sand-100/50">না</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmId(String(row.id))} className="rounded-lg p-1.5 text-sand-100/40 hover:bg-red-500/15 hover:text-red-300" aria-label="মুছুন">
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
        {!rows.length ? <p className="py-10 text-center text-[12px] text-sand-100/40">কোনো এন্ট্রি নেই</p> : null}
      </div>

      {form ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-3 backdrop-blur-sm sm:p-6">
          <form onSubmit={save} className="card my-4 w-full max-w-xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold">{form.id ? "সম্পাদনা" : "নতুন যোগ করুন"}</h2>
              <button type="button" onClick={() => setForm(null)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="বন্ধ">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {fields.map((f) => {
                const value = form[f.name];
                const set = (v: unknown) => setForm((prev) => (prev ? { ...prev, [f.name]: v } : prev));
                return (
                  <label key={f.name} className={f.colSpan === 2 ? "sm:col-span-2" : ""}>
                    <span className="label">{f.label}{f.required ? " *" : ""}</span>
                    {f.type === "textarea" ? (
                      <textarea rows={4} value={String(value ?? "")} onChange={(e) => set(e.target.value)} className="input resize-none" placeholder={f.placeholder} />
                    ) : f.type === "select" ? (
                      <select value={String(value ?? "")} onChange={(e) => set(e.target.value)} className="input">
                        <option value="">নির্বাচন করুন</option>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value} className="bg-ink-800">{o.label}</option>
                        ))}
                      </select>
                    ) : f.type === "checkbox" ? (
                      <span className="flex h-[42px] items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(e) => set(e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-ink-800 accent-leaf-500"
                        />
                        <span className="text-[12px] text-sand-100/60">{f.hint ?? "সক্রিয়"}</span>
                      </span>
                    ) : (
                      <input
                        type={f.type}
                        min={f.type === "number" ? 0 : undefined}
                        step={f.type === "number" ? "any" : undefined}
                        value={String(value ?? "")}
                        onChange={(e) => set(f.type === "number" ? Number(e.target.value) : e.target.value)}
                        className="input"
                        placeholder={f.placeholder}
                      />
                    )}
                    {errors[f.name] ? <p className="mt-1 text-[11px] text-red-300">{errors[f.name]}</p> : null}
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? <Spinner /> : null}
                সংরক্ষণ
              </button>
              <button type="button" onClick={() => setForm(null)} className="btn-ghost">বাতিল</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
