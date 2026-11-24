"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CreditCard,
  Image as ImageIcon,
  Link2,
  Plus,
  Power,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useLocale } from "@/lib/locale";
import { adminHref } from "@/lib/paths";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";
import { ImageField } from "@/components/admin/image-field";
import { Spinner } from "@/components/ui";
import type { PaymentMethodRow } from "@/lib/types";

/* ==========================================================================
   PaymentMethodManager — admin add / edit / delete for payment methods
   --------------------------------------------------------------------------
   The owner manages every receiving method here: bKash, Nagad, Rocket, Upay,
   a bank account, cash on delivery — whatever they want to accept. Each row
   carries the receiving number customers send money to, the account name,
   and the Bangla instructions shown on the payment page.

   Add / Edit open a form modal; Delete removes the row (or deactivates it
   when orders still reference the code). Toggling a row off hides it from
   the checkout without deleting its history.
   ========================================================================== */

type Draft = {
  id?: string;
  code: string;
  name_bn: string;
  name_en: string;
  kind: "mfs" | "bank" | "cod" | "gateway" | "other";
  logo_url: string;
  account_type: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  branch_name: string;
  routing_number: string;
  instruction_bn: string;
  min_amount: string;
  max_amount: string;
  requires_trx: boolean;
  requires_sender: boolean;
  is_active: boolean;
  sort_order: string;
};

const EMPTY: Draft = {
  code: "",
  name_bn: "",
  name_en: "",
  kind: "mfs",
  logo_url: "",
  account_type: "personal",
  account_number: "",
  account_name: "",
  bank_name: "",
  branch_name: "",
  routing_number: "",
  instruction_bn: "",
  min_amount: "1",
  max_amount: "",
  requires_trx: true,
  requires_sender: true,
  is_active: true,
  sort_order: "0",
};

const KIND_LABEL: Record<Draft["kind"], string> = {
  mfs: "মোবাইল ফিনান্সিয়াল (bKash/Nagad/Rocket)",
  bank: "ব্যাংক ট্রান্সফার",
  cod: "ক্যাশ অন ডেলিভারি",
  gateway: "গেটওয়ে (কার্ড)",
  other: "অন্যান্য",
};

export function PaymentMethodManager({
  initial,
  dbReady,
  configured,
}: {
  initial: PaymentMethodRow[];
  dbReady: boolean;
  configured: boolean;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethodRow[]>(initial);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openCreate() {
    setEditing({ ...EMPTY, sort_order: String(methods.length + 1) });
  }

  function openEdit(m: PaymentMethodRow) {
    setEditing({
      id: m.id,
      code: m.code,
      name_bn: m.name_bn,
      name_en: m.name_en ?? "",
      kind: m.kind,
      logo_url: m.logo_url ?? "",
      account_type: m.account_type ?? "",
      account_number: m.account_number ?? "",
      account_name: m.account_name ?? "",
      bank_name: m.bank_name ?? "",
      branch_name: m.branch_name ?? "",
      routing_number: m.routing_number ?? "",
      instruction_bn: m.instruction_bn ?? "",
      min_amount: String(m.min_amount),
      max_amount: m.max_amount == null ? "" : String(m.max_amount),
      requires_trx: m.requires_trx,
      requires_sender: m.requires_sender,
      is_active: m.is_active,
      sort_order: String(m.sort_order),
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.code.trim() || !editing.name_bn.trim()) {
      toast.error(t("কোড ও বাংলা নাম দিন", "Code and Bangla name are required"));
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...(editing.id ? { id: editing.id } : {}),
        code: editing.code.trim(),
        name_bn: editing.name_bn.trim(),
        name_en: editing.name_en.trim(),
        kind: editing.kind,
        logo_url: editing.logo_url.trim(),
        account_type: editing.account_type || null,
        account_number: editing.account_number.trim(),
        account_name: editing.account_name.trim(),
        bank_name: editing.bank_name.trim(),
        branch_name: editing.branch_name.trim(),
        routing_number: editing.routing_number.trim(),
        instruction_bn: editing.instruction_bn.trim(),
        min_amount: Number(editing.min_amount) || 0,
        max_amount: editing.max_amount ? Number(editing.max_amount) : null,
        requires_trx: editing.requires_trx,
        requires_sender: editing.requires_sender,
        is_active: editing.is_active,
        sort_order: Number(editing.sort_order) || 0,
      };

      const res = await fetch("/api/foisal/payment-methods", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "সaving ব্যর্থ");

      if (editing.id) {
        setMethods((prev) => prev.map((m) => (m.id === editing.id ? json.data.method : m)));
        toast.success(t("মেথড আপডেট হয়েছে", "Payment method updated"));
      } else {
        setMethods((prev) => [...prev, json.data.method]);
        toast.success(t("মেথড তৈরি হয়েছে", "Payment method created"));
      }
      setEditing(null);
    } catch (err) {
      toast.error(t("ব্যর্থ", "Failed"), (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: PaymentMethodRow) {
    setBusyId(m.id);
    try {
      const res = await fetch("/api/foisal/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, is_active: !m.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "আপডেট ব্যর্থ");
      setMethods((prev) => prev.map((x) => (x.id === m.id ? json.data.method : x)));
      toast.success(
        !m.is_active ? t("মেথড সক্রিয় হয়েছে", "Method enabled") : t("মেথড বন্ধ হয়েছে", "Method disabled")
      );
    } catch (err) {
      toast.error(t("ব্যর্থ", "Failed"), (err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(m: PaymentMethodRow) {
    const ok = window.confirm(
      `${m.name_bn} মেথডটি মুছে ফেলতে চান?\n\nঅর্ডারে ব্যবহৃত হলে মেথডটি বন্ধ হয়ে যাবে।`
    );
    if (!ok) return;
    setBusyId(m.id);
    try {
      const res = await fetch(`/api/foisal/payment-methods?id=${m.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "মুছতে পারলেন না");
      setMethods((prev) => prev.filter((x) => x.id !== m.id));
      toast.success(
        json.data.deleted
          ? t("মেথড মুছে ফেলা হয়েছে", "Method deleted")
          : t("মেথড বন্ধ করা হয়েছে", "Method deactivated")
      );
    } catch (err) {
      toast.error(t("ব্যর্থ", "Failed"), (err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold sm:text-2xl">{t("পেমেন্ট মাধ্যম ও নম্বর", "Payment methods")}</h1>
          <p className="mt-1 text-[13px] text-sand-100/50">
            {t(
              "ক্লায়েন্ট কোন নম্বরে টাকা পাঠাবেন তা আপনি নিয়ন্ত্রণ করুন। যে কোনো মেথড যোগ, সম্পাদনা বা মুছে ফেলতে পারেন।",
              "Control which number customers send money to. Add, edit, or delete any method."
            )}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-leaf-500/25 bg-leaf-500/10 px-2.5 py-1 text-[11.5px] text-leaf-200">
            <ImageIcon className="h-3.5 w-3.5" />
            {t(
              "সক্রিয় মেথডের লোগো সাইটের ফুটারে ও চেকআউটে দেখানো হয় — সাদা বা স্বচ্ছ ব্যাকগ্রাউন্ডের PNG সবচেয়ে পরিষ্কার দেখায়।",
              "Logos of active methods appear in the site footer and at checkout — a PNG on a white or transparent background looks cleanest."
            )}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" /> {t("নতুন মেথড", "Add method")}
        </button>
      </div>

      {!dbReady ? (
        <div className="card p-8 text-center">
          <p className="text-[14px] font-semibold text-amber-200/90">
            {t("ডেটাবেস সেটআপ হয়নি", "Database is not configured")}
          </p>
          <p className="mt-1 text-[12.5px] text-sand-100/50">
            {t("SQL ফাইল চালিয়ে ডেটাবেস সেটআপ করুন, তার পর এখানে মেথড যোগ করতে পারবেন।", "Run the SQL files to set up the database, then add methods here.")}
          </p>
        </div>
      ) : methods.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-leaf-600/15 text-2xl">💳</span>
          <p className="mt-3 text-[14px] font-semibold">{t("কোনো পেমেন্ট মেথড নেই", "No payment methods yet")}</p>
          <p className="mt-1 text-[12.5px] text-sand-100/50">
            {t("প্রথম মেথডটি যোগ করুন — চেকআউট তখন থেকেই কাজ করতে শুরু করবে।", "Add your first method — checkout will work from that moment.")}
          </p>
          <button onClick={openCreate} className="btn-primary mt-4">
            <Plus className="h-4 w-4" /> {t("প্রথম মেথড যোগ করুন", "Add first method")}
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-sand-100/40">
                  <th className="px-4 py-3 font-semibold">{t("মাধ্যম", "Method")}</th>
                  <th className="px-4 py-3 font-semibold">{t("রিসিভিং নম্বর", "Receiving number")}</th>
                  <th className="px-4 py-3 font-semibold">{t("ধরন", "Kind")}</th>
                  <th className="px-4 py-3 font-semibold">{t("সীমা", "Limits")}</th>
                  <th className="px-4 py-3 font-semibold">{t("স্টেটাস", "Status")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("কাজ", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => (
                  <tr key={m.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {/* white tile, the way the footer shows it */}
                        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1 text-base ring-1 ring-black/10">
                          {m.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.logo_url} alt={m.name_bn} className="h-full w-full object-contain" />
                          ) : (
                            <span aria-hidden>{METHOD_EMOJI[m.code] ?? "💳"}</span>
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold">{m.name_bn}</p>
                          <p className="font-mono text-[10.5px] uppercase text-sand-100/40">{m.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.account_number ? (
                        <span className="font-mono text-[12.5px] text-leaf-200/90">{m.account_number}</span>
                      ) : m.bank_name ? (
                        <span className="text-[12.5px] text-sand-100/70">{m.bank_name}</span>
                      ) : (
                        <span className="text-[12.5px] text-sand-100/40">—</span>
                      )}
                      {m.account_name ? <p className="text-[11px] text-sand-100/40">{m.account_name}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-sand-100/60">{KIND_LABEL[m.kind]}</td>
                    <td className="px-4 py-3 text-sand-100/60">
                      {money(Number(m.min_amount), false)}
                      {m.max_amount != null ? ` – ${money(Number(m.max_amount), false)}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(m)}
                        disabled={busyId === m.id}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                          m.is_active
                            ? "bg-leaf-600/20 text-leaf-700 hover:bg-leaf-600/30"
                            : "bg-white/5 text-sand-100/40 hover:bg-white/10"
                        }`}
                      >
                        {busyId === m.id ? <Spinner className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                        {m.is_active ? t("সক্রিয়", "Active") : t("বন্ধ", "Off")}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(m)}
                          className="rounded-lg border border-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-sand-100/70 transition hover:border-leaf-500/40 hover:text-leaf-200"
                        >
                          {t("সম্পাদনা", "Edit")}
                        </button>
                        <button
                          onClick={() => remove(m)}
                          disabled={busyId === m.id}
                          className="rounded-lg border border-red-400/20 px-2.5 py-1 text-[11.5px] font-semibold text-red-200/70 transition hover:border-red-400/40 hover:text-red-200 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* footer help */}
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-[11.5px] text-sand-100/45">
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-leaf-400" />
          {t("চেকআউটে শুধু সক্রিয় মেথডগুলো দেখা যায়", "Only active methods appear on checkout")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Banknote className="h-3.5 w-3.5 text-leaf-400" />
          {t("টাকা পাঠানোর পর অ্যাডমিন অর্ডার যাচাই করে পরিশোধিত চিহ্নিত করেন", "Admin marks orders paid after receiving the money")}
        </span>
        {!configured ? (
          <Link href={adminHref("system-check")} className="inline-flex items-center gap-1.5 text-leaf-300 hover:underline">
            <Link2 className="h-3.5 w-3.5" /> {t("সেটআপ যাচাই করুন", "Check setup")}
          </Link>
        ) : null}
      </div>

      {/* editor modal */}
      {editing ? (
        <MethodEditor
          draft={editing}
          setDraft={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

const METHOD_EMOJI: Record<string, string> = {
  bkash: "🟢",
  nagad: "🟡",
  rocket: "🚀",
  upay: "💳",
  bank: "🏦",
  cod: "💵",
  sslcommerz: "🏦",
};

function MethodEditor({
  draft,
  setDraft,
  onClose,
  onSave,
  saving,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useLocale();

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft({ ...draft, [key]: value });
  }

  const isBank = draft.kind === "bank";
  const isCod = draft.kind === "cod";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl neu-raised-lg border border-white/85 bg-neu-surface sm:rounded-3xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[16px] font-bold">
            {draft.id ? t("মেথড সম্পাদনা", "Edit method") : t("নতুন পেমেন্ট মেথড", "New payment method")}
          </h2>
          <button onClick={onClose} className="neu-icon-btn h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* identity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">{t("কোড", "Code")} *</span>
              <input
                value={draft.code}
                onChange={(e) => set("code", e.target.value)}
                className="input font-mono"
                placeholder="bkash"
              />
              <p className="mt-1 text-[10.5px] text-sand-100/35">{t("ছোট হাতের ইংরেজি (bkash, nagad, bank…)", "lowercase English (bkash, nagad, bank…)")}</p>
            </label>
            <label>
              <span className="label">{t("ধরন", "Kind")} *</span>
              <select value={draft.kind} onChange={(e) => set("kind", e.target.value as Draft["kind"])} className="input">
                {(Object.keys(KIND_LABEL) as Draft["kind"][]).map((k) => (
                  <option key={k} value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">{t("বাংলা নাম", "Bangla name")} *</span>
              <input
                value={draft.name_bn}
                onChange={(e) => set("name_bn", e.target.value)}
                className="input"
                placeholder="বিকাশ"
              />
            </label>
            <label>
              <span className="label">{t("ইংরেজি নাম (ঐচ্ছিক)", "English name (optional)")}</span>
              <input
                value={draft.name_en}
                onChange={(e) => set("name_en", e.target.value)}
                className="input"
                placeholder="bKash"
              />
            </label>
          </div>

          {/* logo */}
          <div>
            <span className="label">{t("লোগো (ঐচ্ছিক)", "Logo (optional)")}</span>
            <ImageField
              value={draft.logo_url}
              onChange={(url) => set("logo_url", url)}
              bucket="payment-logos"
              hint={t(
                "সাইটের ফুটারে সাদা টাইলের ভেতরে এই লোগোই দেখাবে। সাদা/স্বচ্ছ ব্যাকগ্রাউন্ডের PNG, লম্বালেজি বা স্কয়ার — দুটোই চলে।",
                "This is the logo shown in the white tiles in the site footer. PNG on a white or transparent background; wide or square both work."
              )}
              ratio="square"
            />
          </div>

          {/* receiving details */}
          {!isCod ? (
            <div className="rounded-2xl border border-white/[0.08] p-4">
              <p className="mb-3 text-[12px] font-bold text-sand-100/70">{t("রিসিভিং তথ্য", "Receiving details")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="label">{t("অ্যাকাউন্ট ধরন", "Account type")}</span>
                  <select
                    value={draft.account_type}
                    onChange={(e) => set("account_type", e.target.value)}
                    className="input"
                  >
                    <option value="personal">{t("ব্যক্তিগত", "Personal")}</option>
                    <option value="agent">{t("এজেন্ট", "Agent")}</option>
                    <option value="merchant">{t("মেরিচেন্ট", "Merchant")}</option>
                    <option value="account">{t("অ্যাকাউন্ট", "Account")}</option>
                  </select>
                </label>
                <label>
                  <span className="label">
                    {isBank ? t("অ্যাকাউন্ট নম্বর / রেফারেন্স", "Account / reference number") : t("রিসিভিং নম্বর", "Receiving number")}
                  </span>
                  <input
                    value={draft.account_number}
                    onChange={(e) => set("account_number", e.target.value)}
                    className="input font-mono"
                    placeholder={isBank ? "01700-123456" : "01712345678"}
                  />
                </label>
                <label>
                  <span className="label">{t("অ্যাকাউন্ট নাম", "Account name")}</span>
                  <input
                    value={draft.account_name}
                    onChange={(e) => set("account_name", e.target.value)}
                    className="input"
                    placeholder="বিশ্বাস এগ্রো"
                  />
                </label>
                {isBank ? (
                  <>
                    <label>
                      <span className="label">{t("ব্যাংক নাম", "Bank name")}</span>
                      <input
                        value={draft.bank_name}
                        onChange={(e) => set("bank_name", e.target.value)}
                        className="input"
                        placeholder="Sonali Bank"
                      />
                    </label>
                    <label>
                      <span className="label">{t("ব্র্যান্চ", "Branch")}</span>
                      <input
                        value={draft.branch_name}
                        onChange={(e) => set("branch_name", e.target.value)}
                        className="input"
                        placeholder="Gulshan"
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-leaf-500/20 bg-leaf-600/[0.05] p-4">
              <p className="text-[12px] text-leaf-200/80">
                {t("ক্যাশ অন ডেলিভারি — কোনো রিসিভিং নম্বর দরকার নেই। পণ্য হাতে পেয়ে টাকা দেওয়া হবে।", "Cash on delivery — no receiving number needed. Cash is handed over at delivery.")}
              </p>
            </div>
          )}

          {/* instructions */}
          <label>
            <span className="label">{t("পেমেন্ট নির্দেশনা (বাংলা)", "Payment instructions (Bangla)")}</span>
            <textarea
              value={draft.instruction_bn}
              onChange={(e) => set("instruction_bn", e.target.value)}
              className="input min-h-[96px] resize-y"
              placeholder={"১. bKash অ্যাপ খুলুন।\n২. Send Money-তে গিয়ে উপরের নম্বরে টাকা পাঠান।\n৩. প্রাপ্ত TrxID কিংবা পাঠানোর  screenshot আমাদের জানান।"}
            />
            <p className="mt-1 text-[10.5px] text-sand-100/35">{t("লাইনের ভিত্তিতে নির্দেশনা দেখানো হবে", "Shown as numbered steps on the payment page")}</p>
          </label>

          {/* limits */}
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className="label">{t("ন্যূনতম (৳)", "Min (৳)")}</span>
              <input
                type="number"
                value={draft.min_amount}
                onChange={(e) => set("min_amount", e.target.value)}
                className="input"
                min="0"
              />
            </label>
            <label>
              <span className="label">{t("সর্বোচ্চ (৳)", "Max (৳)")}</span>
              <input
                type="number"
                value={draft.max_amount}
                onChange={(e) => set("max_amount", e.target.value)}
                className="input"
                min="0"
                placeholder="—"
              />
            </label>
            <label>
              <span className="label">{t("দেখার ক্রম", "Display order")}</span>
              <input
                type="number"
                value={draft.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
                className="input"
                min="0"
              />
            </label>
          </div>

          {/* flags */}
          {!isCod ? (
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[12.5px] text-sand-100/70">
                <input
                  type="checkbox"
                  checked={draft.requires_trx}
                  onChange={(e) => set("requires_trx", e.target.checked)}
                  className="accent-leaf-500 h-4 w-4"
                />
                {t("TrxID প্রয়োজন", "Requires TrxID")}
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-sand-100/70">
                <input
                  type="checkbox"
                  checked={draft.requires_sender}
                  onChange={(e) => set("requires_sender", e.target.checked)}
                  className="accent-leaf-500 h-4 w-4"
                />
                {t("সেন্ডার নম্বর প্রয়োজন", "Requires sender number")}
              </label>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-[12.5px] text-sand-100/70">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="accent-leaf-500 h-4 w-4"
            />
            {t("চেকআউটে দেখানো হবে (সক্রিয়)", "Show on checkout (active)")}
          </label>
        </div>

        {/* footer */}
        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
          <button onClick={onClose} className="btn-ghost">{t("বাদ দিন", "Cancel")}</button>
          <button onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {draft.id ? t("সাবমিট করুন", "Save changes") : t("যোগ করুন", "Add method")}
          </button>
        </div>
      </div>
    </div>
  );
}
