"use client";

import { useMemo, useState } from "react";
import { MapPin, Plus, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { divisions, districtsOf, upazilasOf } from "@/lib/bd-locations";
import { EmptyState, Spinner } from "./ui";
import type { Address } from "@/lib/types";

export function AddressManager({ initial }: { initial: Address[] }) {
  const { t } = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [addresses, setAddresses] = useState(initial);
  const [open, setOpen] = useState(initial.length === 0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    label: "বাসা",
    full_name: "",
    phone: "",
    division: "",
    district: "",
    upazila: "",
    address: "",
    is_default: false,
  });

  const districtList = useMemo(() => (form.division ? districtsOf(form.division) : []), [form.division]);
  const upazilaList = useMemo(
    () => (form.division && form.district ? upazilasOf(form.division, form.district) : []),
    [form.division, form.district]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        throw new Error(json.message ?? "ঠিকানা সংরক্ষণ হয়নি");
      }
      setAddresses((prev) => [json.data, ...prev.map((a) => (form.is_default ? { ...a, is_default: false } : a))]);
      setForm({ label: "বাসা", full_name: "", phone: "", division: "", district: "", upazila: "", address: "", is_default: false });
      setOpen(false);
      toast.success(t("ঠিকানা সংরক্ষিত হয়েছে", "Address saved"));
      router.refresh();
    } catch (err) {
      toast.error(t("সংরক্ষণ ব্যর্থ", "Could not save"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/addresses?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("মুছে ফেলা যায়নি");
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success(t("ঠিকানা মুছে ফেলা হয়েছে", "Address removed"));
    } catch (err) {
      toast.error(t("ব্যর্থ", "Failed"), (err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> {t("নতুন ঠিকানা যোগ করুন", "Add new address")}
        </button>
      ) : (
        <form onSubmit={submit} className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">{t("নতুন ঠিকানা", "New address")}</h2>
            {addresses.length ? (
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="বন্ধ">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">{t("লেবেল", "Label")}</span>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input" placeholder="বাসা / অফিস" />
            </label>
            <label>
              <span className="label">{t("প্রাপকের নাম", "Recipient name")} *</span>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" />
              {errors.full_name ? <p className="mt-1 text-[11px] text-red-300">{errors.full_name}</p> : null}
            </label>
            <label>
              <span className="label">{t("মোবাইল", "Mobile")} *</span>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" inputMode="tel" placeholder="01712345678" />
              {errors.phone ? <p className="mt-1 text-[11px] text-red-300">{errors.phone}</p> : null}
            </label>
            <label>
              <span className="label">{t("বিভাগ", "Division")} *</span>
              <select
                required
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value, district: "", upazila: "" })}
                className="input"
              >
                <option value="">নির্বাচন করুন</option>
                {Object.keys(divisions).map((d) => <option key={d} value={d} className="bg-ink-800">{d}</option>)}
              </select>
            </label>
            <label>
              <span className="label">{t("জেলা", "District")} *</span>
              <select
                required
                value={form.district}
                disabled={!form.division}
                onChange={(e) => setForm({ ...form, district: e.target.value, upazila: "" })}
                className="input disabled:opacity-40"
              >
                <option value="">নির্বাচন করুন</option>
                {districtList.map((d) => <option key={d} value={d} className="bg-ink-800">{d}</option>)}
              </select>
            </label>
            <label>
              <span className="label">{t("উপজেলা", "Upazila")} *</span>
              <select
                required
                value={form.upazila}
                disabled={!form.district}
                onChange={(e) => setForm({ ...form, upazila: e.target.value })}
                className="input disabled:opacity-40"
              >
                <option value="">নির্বাচন করুন</option>
                {upazilaList.map((u) => <option key={u} value={u} className="bg-ink-800">{u}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="label">{t("সম্পূর্ণ ঠিকানা", "Full address")} *</span>
              <textarea
                required
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input resize-none"
                placeholder="বাসা ১২, রোড ৭, ধানমন্ডি"
              />
              {errors.address ? <p className="mt-1 text-[11px] text-red-300">{errors.address}</p> : null}
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="h-4 w-4 rounded border-white/20 bg-ink-800 accent-leaf-500"
              />
              <span className="text-[12.5px] text-sand-100/70">{t("ডিফল্ট ঠিকানা হিসেবে সেট করুন", "Set as default address")}</span>
            </label>
          </div>

          <button type="submit" disabled={loading} className="btn-primary mt-4">
            {loading ? <Spinner /> : <MapPin className="h-4 w-4" />}
            {t("সংরক্ষণ করুন", "Save address")}
          </button>
        </form>
      )}

      {addresses.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <article key={a.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="badge bg-white/[0.06] text-sand-100/70">{a.label}</span>
                {a.is_default ? (
                  <span className="badge bg-leaf-600/20 text-leaf-700">
                    <Star className="h-2.5 w-2.5 fill-current" /> ডিফল্ট
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[13px] font-semibold">{a.full_name}</p>
              <p className="text-[11.5px] text-sand-100/50">{a.phone}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-sand-100/60">
                {a.address}, {a.upazila}, {a.district}, {a.division}
              </p>
              <button
                onClick={() => remove(a.id)}
                className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] text-red-300/70 hover:text-red-300"
              >
                <Trash2 className="h-3 w-3" /> {t("মুছুন", "Remove")}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {!addresses.length && !open ? (
        <EmptyState icon="📍" title="কোনো ঠিকানা নেই" body="ডেলিভারি দ্রুত করতে একটি ঠিকানা সংরক্ষণ করুন।" />
      ) : null}
    </div>
  );
}
