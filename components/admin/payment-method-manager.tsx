"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Landmark,
  Pencil,
  Plus,
  Power,
  Save,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { ImageField } from "./image-field";
import type { PaymentMethodRow } from "@/lib/types";

/* ==========================================================================
   PaymentMethodManager — bKash / Nagad / Rocket / bank / COD, no code edits
   --------------------------------------------------------------------------
   The single most important field is `account_number`: the number customers
   send money to. It is shown prominently in the list (with a copy button) so
   the owner can verify at a glance that the live number is the right one.

   Reordering is two buttons rather than drag-and-drop on purpose — a mis-drop
   here would send customers to an old bKash number.
   ========================================================================== */

const KIND_META: Record<string, { label: string; Icon: typeof Smartphone }> = {
  mfs: { label: "মোবাইল ওয়ালেট", Icon: Smartphone },
  bank: { label: "ব্যাংক", Icon: Landmark },
  cod: { label: "ক্যাশ অন ডেলিভারি", Icon: Banknote },
  gateway: { label: "গেটওয়ে", Icon: CreditCard },
  other: { label: "অন্যান্য", Icon: CreditCard },
};

const ACCOUNT_TYPES = [
  { value: "personal", label: "Personal" },
  { value: "agent", label: "Agent" },
  { value: "merchant", label: "Merchant" },
  { value: "account", label: "ব্যাংক অ্যাকাউন্ট" },
];

const KINDS = [
  { value: "mfs", label: "মোবাইল ওয়ালেট (বিকাশ/নগদ/রকেট)" },
  { value: "bank", label: "ব্যাংক ট্রান্সফার" },
  { value: "cod", label: "ক্যাশ অন ডেলিভারি" },
  { value: "gateway", label: "অটো গেটওয়ে (SSLCommerz)" },
  { value: "other", label: "অন্যান্য" },
];

type Draft = Partial<PaymentMethodRow> & { id?: string };

const EMPTY: Draft = {
  code: "",
  name_bn: "",
  name_en: "",
  kind: "mfs",
  account_type: "personal",
  account_number: "",
  account_name: "",
  instruction_bn: "",
  min_amount: 10,
  max_amount: null,
  trx_pattern: "^[A-Z0-9]{8,12}$",
  requires_trx: true,
  requires_sender: true,
  is_active: true,
  sort_order: 0,
  logo_url: "",
};

export function PaymentMethodManager({ initial }: { initial: PaymentMethodRow[] }) {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<PaymentMethodRow[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function open(row?: PaymentMethodRow) {
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
      const res = await fetch("/api/foisal/payment-methods", {
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
          ? prev.map((r) => (r.id === draft.id ? (json.data as PaymentMethodRow) : r))
          : [...prev, json.data as PaymentMethodRow].sort((a, b) => a.sort_order - b.sort_order)
      );
      toast.success(isEdit ? "আপডেট হয়েছে" : "নতুন মাধ্যম যোগ হয়েছে", "ওয়েবসাইটে সাথে সাথে দেখা যাবে");
      setDraft(null);
      router.refresh();
    } catch (error) {
      toast.error("সংরক্ষণ হয়নি", (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: PaymentMethodRow) {
    const next = !row.is_active;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)));

    const res = await fetch("/api/foisal/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, is_active: next }),
    });

    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !next } : r)));
      toast.error("পরিবর্তন হয়নি", "আবার চেষ্টা করুন");
    } else {
      toast.success(next ? "চালু করা হয়েছে" : "বন্ধ করা হয়েছে");
      router.refresh();
    }
  }

  async function move(row: PaymentMethodRow, direction: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((r) => r.id === row.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;

    const next = [...rows].map((r) => {
      if (r.id === row.id) return { ...r, sort_order: swapWith.sort_order };
      if (r.id === swapWith.id) return { ...r, sort_order: row.sort_order };
      return r;
    });
    setRows(next.sort((a, b) => a.sort_order - b.sort_order));

    // Persist both rows; the version column is not used, so two updates are safe.
    await Promise.all([
      fetch("/api/foisal/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...row, sort_order: swapWith.sort_order }),
      }),
      fetch("/api/foisal/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...swapWith, sort_order: row.sort_order }),
      }),
    ]);
    router.refresh();
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/foisal/payment-methods?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "মুছে ফেলা যায়নি");

      if (json.data?.deactivated) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: false } : r)));
        toast.success("বন্ধ করা হয়েছে", "পুরনো পেমেন্ট থাকায় মুছে ফেলা হয়নি, শুধু বন্ধ হয়েছে");
      } else {
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast.success("মুছে ফেলা হয়েছে");
      }
      setConfirmId(null);
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
          <h1 className="text-xl font-bold">পেমেন্ট মাধ্যম</h1>
          <p className="mt-0.5 text-[11.5px] text-sand-100/45">
            গ্রাহক যে নম্বরে টাকা পাঠাবে সেটি এখানে বদলান — কোড ছোঁয়া লাগবে না
          </p>
        </div>
        <button onClick={() => open()} className="btn-primary min-h-[40px] rounded-xl px-4 text-[13px]">
          <Plus className="h-4 w-4" /> নতুন মাধ্যম
        </button>
      </div>

      <div className="space-y-2">
        {sorted.map((row, index) => {
          const meta = KIND_META[row.kind] ?? KIND_META.other;
          return (
            <div
              key={row.id}
              className={`card flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap ${
                row.is_active ? "" : "opacity-55"
              }`}
            >
              {/* logo / icon */}
              <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.06]">
                {row.logo_url ? (
                  <Image src={row.logo_url} alt="" fill sizes="44px" className="object-contain p-1" />
                ) : (
                  <meta.Icon className="h-5 w-5 text-leaf-300" />
                )}
              </div>

              {/* identity + the receiving number */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[13px] font-semibold">{row.name_bn}</p>
                  <span className="rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] text-sand-100/50">
                    {meta.label}
                  </span>
                  {row.account_type ? (
                    <span className="rounded-full bg-leaf-600/15 px-1.5 py-0.5 text-[9px] text-leaf-200">
                      {ACCOUNT_TYPES.find((t) => t.value === row.account_type)?.label ?? row.account_type}
                    </span>
                  ) : null}
                  {!row.is_active ? (
                    <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] text-red-300">
                      বন্ধ
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-sand-100/50">
                  <span className="font-mono text-leaf-200">{row.account_number ?? "নম্বর দেওয়া হয়নি"}</span>
                  {row.account_number ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(row.account_number ?? "");
                        toast.success("কপি হয়েছে");
                      }}
                      className="text-sand-100/35 hover:text-leaf-200"
                      aria-label="নম্বর কপি"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  ) : null}
                  <span className="text-sand-100/25">·</span>
                  <span>
                    {money(Number(row.min_amount))}
                    {row.max_amount ? ` – ${money(Number(row.max_amount))}` : "+"}
                  </span>
                  {row.requires_trx ? (
                    <>
                      <span className="text-sand-100/25">·</span>
                      <span>TrxID লাগে</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => move(row, -1)}
                  disabled={index === 0}
                  className="rounded-lg p-1.5 text-sand-100/40 hover:bg-white/10 hover:text-sand-100 disabled:opacity-20"
                  aria-label="উপরে"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(row, 1)}
                  disabled={index === sorted.length - 1}
                  className="rounded-lg p-1.5 text-sand-100/40 hover:bg-white/10 hover:text-sand-100 disabled:opacity-20"
                  aria-label="নিচে"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggle(row)}
                  className={`rounded-lg p-1.5 hover:bg-white/10 ${
                    row.is_active ? "text-leaf-300" : "text-sand-100/35"
                  }`}
                  aria-label={row.is_active ? "বন্ধ করুন" : "চালু করুন"}
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => open(row)}
                  className="rounded-lg p-1.5 text-sand-100/40 hover:bg-white/10 hover:text-sand-100"
                  aria-label="সম্পাদনা"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setConfirmId(row.id)}
                  className="rounded-lg p-1.5 text-sand-100/30 hover:bg-red-500/15 hover:text-red-300"
                  aria-label="মুছুন"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {confirmId === row.id ? (
                <div className="flex w-full items-center justify-between gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-[11.5px] sm:w-auto">
                  <span>নিশ্চিত? পুরনো পেমেন্ট থাকলে শুধু বন্ধ হবে।</span>
                  <span className="flex gap-1.5">
                    <button onClick={() => remove(row.id)} className="rounded-lg bg-red-500/25 px-2 py-1 font-semibold text-red-200">
                      হ্যাঁ
                    </button>
                    <button onClick={() => setConfirmId(null)} className="rounded-lg bg-white/10 px-2 py-1">
                      না
                    </button>
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ---- editor drawer */}
      {draft ? (
        <div className="fixed inset-0 z-[96]">
          <button
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
            onClick={() => setDraft(null)}
            aria-label="বন্ধ"
          />
          <form
            onSubmit={save}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-ink-900"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-[14px] font-bold">{draft.id ? "মাধ্যম সম্পাদনা" : "নতুন পেমেন্ট মাধ্যম"}</h2>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1.5 text-sand-100/50 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="বাংলা নাম" error={errors.name_bn} required>
                  <input className="inp" value={draft.name_bn ?? ""} onChange={(e) => set("name_bn", e.target.value)} placeholder="বিকাশ" />
                </Field>
                <Field label="কোড" error={errors.code} required hint="ছোট হাতের ইংরেজি, যেমন bkash">
                  <input
                    className="inp font-mono"
                    value={draft.code ?? ""}
                    onChange={(e) => set("code", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="bkash"
                  />
                </Field>
              </div>

              <Field label="ধরন">
                <select className="inp" value={draft.kind ?? "mfs"} onChange={(e) => set("kind", e.target.value as PaymentMethodRow["kind"])}>
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </Field>

              <ImageField
                label="লোগো (ঐচ্ছিক)"
                value={draft.logo_url ?? ""}
                onChange={(url) => set("logo_url", url)}
                bucket="payment-logos"
                ratio="square"
                hint="বিকাশ/নগদ লোগো আপলোড করুন — ফোনের গ্যালারি থেকেও চলবে"
              />

              <Field
                label="টাকা পাঠানোর নম্বর / অ্যাকাউন্ট"
                error={errors.account_number}
                hint="এটিই গ্রাহক দেখবে — সঠিক নম্বর দিন"
              >
                <input
                  className="inp font-mono text-[14px] tracking-wide"
                  value={draft.account_number ?? ""}
                  onChange={(e) => set("account_number", e.target.value)}
                  placeholder="01712345678"
                  inputMode="tel"
                />
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="অ্যাকাউন্টের ধরন">
                  <select
                    className="inp"
                    value={draft.account_type ?? "personal"}
                    onChange={(e) => set("account_type", e.target.value as PaymentMethodRow["account_type"])}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="অ্যাকাউন্টের নাম">
                  <input className="inp" value={draft.account_name ?? ""} onChange={(e) => set("account_name", e.target.value)} placeholder="বিশ্বাস এগ্রো" />
                </Field>
              </div>

              {draft.kind === "bank" ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="ব্যাংকের নাম">
                    <input className="inp" value={draft.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} placeholder="Dutch Bangla Bank" />
                  </Field>
                  <Field label="ব্র্যাঞ্চ">
                    <input className="inp" value={draft.branch_name ?? ""} onChange={(e) => set("branch_name", e.target.value)} />
                  </Field>
                </div>
              ) : null}

              <Field label="বাংলায় নির্দেশনা" hint="গ্রাহক পেমেন্ট পেজে এই লেখাটি দেখবে">
                <textarea
                  className="inp min-h-[74px]"
                  value={draft.instruction_bn ?? ""}
                  onChange={(e) => set("instruction_bn", e.target.value)}
                  placeholder="বিকাশ অ্যাপ → Send Money → উপরের নম্বরে টাকা পাঠান…"
                />
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="সর্বনিম্ন ৳">
                  <input
                    className="inp"
                    type="number"
                    min={0}
                    value={draft.min_amount ?? 0}
                    onChange={(e) => set("min_amount", Number(e.target.value))}
                  />
                </Field>
                <Field label="সর্বোচ্চ ৳" hint="খালি রাখলে সীমা নেই">
                  <input
                    className="inp"
                    type="number"
                    min={0}
                    value={draft.max_amount ?? ""}
                    onChange={(e) => set("max_amount", e.target.value === "" ? null : Number(e.target.value))}
                  />
                </Field>
              </div>

              <Field
                label="TrxID ফরম্যাট (রেগুলার এক্সপ্রেশন)"
                error={errors.trx_pattern}
                hint="বিকাশ/নগদ সাধারণত ৮–১২ অক্ষর। খালি রাখলে ডিফল্ট ব্যবহার হবে।"
              >
                <input className="inp font-mono text-[11.5px]" value={draft.trx_pattern ?? ""} onChange={(e) => set("trx_pattern", e.target.value)} placeholder="^[A-Z0-9]{8,12}$" />
              </Field>

              <div className="space-y-1.5 rounded-xl bg-white/[0.03] p-2.5">
                <Check label="TrxID আবশ্যক" checked={Boolean(draft.requires_trx)} onChange={(v) => set("requires_trx", v)} />
                <Check label="প্রেরকের নম্বর আবশ্যক" checked={Boolean(draft.requires_sender)} onChange={(v) => set("requires_sender", v)} />
                <Check label="সাইটে চালু" checked={Boolean(draft.is_active)} onChange={(v) => set("is_active", v)} />
              </div>

              <Field label="ক্রম">
                <input className="inp" type="number" value={draft.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} />
              </Field>
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

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11.5px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-leaf-500" />
      {label}
    </label>
  );
}
