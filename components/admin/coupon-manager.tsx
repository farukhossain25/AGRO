"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Trash2, Users, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn, money, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   Coupon manager
   --------------------------------------------------------------------------
   The generic SimpleManager cannot express a coupon: the four rules that make
   one safe (per-account use, who may use it, how many people in total, when it
   starts) all interact, and a restricted code needs a list of people who are
   picked by phone/email — not by id.

   So this screen owns its own modal. Everything it writes goes to
   /api/foisal/coupons, which validates with couponSchema and syncs
   coupon_audiences.
   ========================================================================== */

type Row = Record<string, unknown>;

const AUDIENCE_LABEL: Record<string, string> = {
  all: "সবার জন্য",
  assigned: "নির্দিষ্ট অ্যাকাউন্ট",
  influencer: "ইনফ্লুয়েন্সার",
};

const EMPTY: Row = {
  code: "",
  description_bn: "",
  type: "percent",
  value: 10,
  min_order: 0,
  max_discount: null,
  usage_limit: null,
  per_user_limit: 1,
  starts_at: "",
  expires_at: "",
  is_active: true,
  audience: "all",
  funder_user_id: "",
  funder_note: "",
  audience_contacts: [],
};

/** ISO → the `yyyy-mm-dd` an <input type="date"> needs. */
function dateOnly(value: unknown): string {
  const raw = String(value ?? "");
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function CouponManager({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<Row[]>(initial);
  const [form, setForm] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [contactsText, setContactsText] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  const set = (key: string, value: unknown) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  async function open(row: Row) {
    const next: Row = { ...EMPTY, ...row };
    next.starts_at = dateOnly(row.starts_at);
    next.expires_at = dateOnly(row.expires_at);
    setForm(next);
    setContactsText("");
    // Editing a restricted coupon must show who it is already given to.
    if (row.id && next.audience === "assigned") {
      setLoadingContacts(true);
      try {
        const res = await fetch(`/api/foisal/coupon-audiences?id=${row.id}`);
        const json = await res.json();
        if (res.ok) setContactsText(((json.data?.contacts ?? []) as string[]).join("\n"));
      } catch {
        /* the list is a convenience — saving still works without it */
      } finally {
        setLoadingContacts(false);
      }
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const payload: Row = { ...form };
      /* Only an `assigned` coupon keeps a list. An influencer code is open on
         purpose — the influencer decides who gets it. */
      payload.audience_contacts =
        payload.audience === "assigned"
          ? contactsText
              .split(/[\n,]/)
              .map((c) => c.trim())
              .filter(Boolean)
          : [];
      // An empty code is the only thing the API cannot fix for us.
      if (!String(payload.code ?? "").trim()) throw new Error("কুপন কোড দিন");

      const isEdit = Boolean(form.id);
      const res = await fetch("/api/foisal/coupons", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "সংরক্ষণ ব্যর্থ");

      const missing = (json.data?.audience_missing ?? []) as string[];
      if (missing.length) {
        toast.error(
          "কিছু অ্যাকাউন্ট পাওয়া যায়নি",
          missing.slice(0, 5).join(", ") + (missing.length > 5 ? ` … +${missing.length - 5}` : "")
        );
      } else {
        toast.success(isEdit ? "আপডেট হয়েছে" : "কুপন যোগ হয়েছে");
      }

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
      const res = await fetch(`/api/foisal/coupons?id=${id}`, { method: "DELETE" });
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

  useEffect(() => setRows(initial), [initial]);

  const contactCount = useMemo(
    () => contactsText.split(/[\n,]/).map((c) => c.trim()).filter(Boolean).length,
    [contactsText]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">কুপন</h1>
          <p className="text-[12px] text-sand-100/45">
            {toBn(rows.length)}টি কুপন · প্রতিটি অ্যাকাউন্টে একবার, নির্দিষ্ট অ্যাকাউন্ট বা ইনফ্লুয়েন্সারের জন্য
          </p>
        </div>
        <button onClick={() => open(EMPTY)} className="btn-primary btn-sm">
          <Plus className="h-4 w-4" /> নতুন কুপন
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12px]">
          <thead>
            <tr className="border-b border-white/10 text-left text-sand-100/45">
              <th className="px-3 py-2">কোড</th>
              <th className="px-3 py-2">ছাড়</th>
              <th className="px-3 py-2">কে ব্যবহার করতে পারবে</th>
              <th className="px-3 py-2">সীমা</th>
              <th className="px-3 py-2">মেয়াদ</th>
              <th className="px-3 py-2">স্টেটাস</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const used = Number(r.used_count ?? 0);
              const limit = r.usage_limit == null ? null : Number(r.usage_limit);
              const perUser = Number(r.per_user_limit ?? 1);
              return (
                <tr key={String(r.id)} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-mono text-[12.5px] font-semibold text-leaf-300">
                      {String(r.code)}
                    </span>
                    {r.description_bn ? (
                      <p className="text-[11px] text-sand-100/40">{String(r.description_bn)}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {r.type === "percent" ? `${toBn(Number(r.value))}%` : money(Number(r.value), true)}
                    {r.min_order ? (
                      <p className="text-[10.5px] text-sand-100/40">{money(Number(r.min_order), true)}+</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="badge">{AUDIENCE_LABEL[String(r.audience ?? "all")] ?? "সবার জন্য"}</span>
                    {r.audience === "influencer" && r.share_token ? (
                      <p className="mt-0.5 font-mono text-[10px] text-sand-100/40">
                        /?ref={String(r.share_token)}
                      </p>
                    ) : null}
                    {r.funder_note ? (
                      <p className="text-[10.5px] text-sand-100/40">{String(r.funder_note)}</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {limit == null ? `${toBn(used)} / ∞` : `${toBn(used)} / ${toBn(limit)}`}
                    <p className="text-[10.5px] text-sand-100/40">প্রতি ইউজার {toBn(perUser)} বার</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sand-100/60">
                    {r.expires_at ? formatDateBn(String(r.expires_at)) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={r.is_active ? "badge bg-leaf-600/20 text-leaf-700" : "badge bg-white/[0.07] text-sand-100/50"}>
                      {r.is_active ? "সক্রিয়" : "বন্ধ"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button onClick={() => open(r)} className="rounded p-1.5 hover:bg-white/10" aria-label="সম্পাদনা">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmId(String(r.id))}
                      className="rounded p-1.5 text-red-300 hover:bg-red-500/10"
                      aria-label="মুছুন"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="py-10 text-center text-[12px] text-sand-100/40">কোনো কুপন নেই — &quot;নতুন কুপন&quot; চাপুন</p>
        ) : null}
      </div>

      {confirmId ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink-950/80 p-4">
          <div className="card w-full max-w-sm p-5 text-center">
            <p className="text-[13px]">এই কুপনটি মুছে ফেলবেন? পুরোনো অর্ডারে দেওয়া ছাড় অপরিবর্তিত থাকবে।</p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => setConfirmId(null)} className="btn-ghost btn-sm">না</button>
              <button onClick={() => remove(confirmId)} className="btn-sm bg-red-600 text-white">মুছুন</button>
            </div>
          </div>
        </div>
      ) : null}

      {form ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-3 backdrop-blur-sm sm:p-6">
          <form onSubmit={save} className="card my-4 w-full max-w-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold">{form.id ? "কুপন সম্পাদনা" : "নতুন কুপন"}</h2>
              <button type="button" onClick={() => setForm(null)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="বন্ধ">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">কুপন কোড *</span>
                <input
                  value={String(form.code ?? "")}
                  onChange={(e) => set("code", e.target.value.toUpperCase())}
                  className="input font-mono"
                  placeholder="AGRO10"
                  required
                />
              </label>
              <label>
                <span className="label">বর্ণনা (গ্রাহক দেখবে)</span>
                <input
                  value={String(form.description_bn ?? "")}
                  onChange={(e) => set("description_bn", e.target.value)}
                  className="input"
                  placeholder="প্রথম অর্ডারে ১০% ছাড়"
                />
              </label>

              <label>
                <span className="label">ধরন</span>
                <select value={String(form.type ?? "percent")} onChange={(e) => set("type", e.target.value)} className="input">
                  <option value="percent" className="bg-ink-800">শতাংশ (%)</option>
                  <option value="fixed" className="bg-ink-800">নির্দিষ্ট টাকা (৳)</option>
                </select>
              </label>
              <label>
                <span className="label">পরিমাণ</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={String(form.value ?? "")}
                  onChange={(e) => set("value", e.target.value)}
                  className="input"
                  required
                />
              </label>

              <label>
                <span className="label">ন্যূনতম অর্ডার (৳)</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={String(form.min_order ?? 0)}
                  onChange={(e) => set("min_order", e.target.value)}
                  className="input"
                />
              </label>
              <label>
                <span className="label">সর্বোচ্চ ছাড় (৳)</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.max_discount == null ? "" : String(form.max_discount)}
                  onChange={(e) => set("max_discount", e.target.value === "" ? null : e.target.value)}
                  className="input"
                  placeholder="সীমা নেই"
                />
              </label>

              <label>
                <span className="label">মোট কতজন ব্যবহার করতে পারবে</span>
                <input
                  type="number"
                  min={0}
                  value={form.usage_limit == null ? "" : String(form.usage_limit)}
                  onChange={(e) => set("usage_limit", e.target.value === "" ? null : e.target.value)}
                  className="input"
                  placeholder="সীমা নেই"
                />
                <span className="mt-1 block text-[10.5px] text-sand-100/40">
                  ফাঁকা রাখলে যতজন চায় — তবে প্রতিটি অ্যাকাউন্ট একবারই
                </span>
              </label>
              <label>
                <span className="label">এক অ্যাকাউন্ট কতবার</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={String(form.per_user_limit ?? 1)}
                  onChange={(e) => set("per_user_limit", e.target.value)}
                  className="input"
                />
                <span className="mt-1 block text-[10.5px] text-sand-100/40">
                  ১ রাখলে ব্যবহারের পর ওই অ্যাকাউন্ট আর কুপনটি দেখবে না
                </span>
              </label>

              <label>
                <span className="label">শুরু</span>
                <input type="date" value={String(form.starts_at ?? "")} onChange={(e) => set("starts_at", e.target.value)} className="input" />
              </label>
              <label>
                <span className="label">মেয়াদ শেষ</span>
                <input type="date" value={String(form.expires_at ?? "")} onChange={(e) => set("expires_at", e.target.value)} className="input" />
              </label>

              <label className="sm:col-span-2">
                <span className="label">কে ব্যবহার করতে পারবে</span>
                <select value={String(form.audience ?? "all")} onChange={(e) => set("audience", e.target.value)} className="input">
                  <option value="all" className="bg-ink-800">সবার জন্য (পাবলিক কোড)</option>
                  <option value="assigned" className="bg-ink-800">শুধু নিচের তালিকার অ্যাকাউন্ট</option>
                  <option value="influencer" className="bg-ink-800">ইনফ্লুয়েন্সার (যাকেই খুশি দিতে পারবেন)</option>
                </select>
              </label>

              {form.audience !== "all" ? (
                <>
                  <label>
                    <span className="label">ইনফ্লুয়েন্সারের ফোন / ইমেইল</span>
                    <input
                      value={String(form.funder_user_id ?? "")}
                      onChange={(e) => set("funder_user_id", e.target.value.trim())}
                      className="input"
                      placeholder="01XXXXXXXXX"
                    />
                    <span className="mt-1 block text-[10.5px] text-sand-100/40">
                      ইনফ্লুয়েন্সার নিজেও কোডটি ব্যবহার করতে পারবেন
                    </span>
                  </label>
                  <label>
                    <span className="label">নোট (শুধু অ্যাডমিন)</span>
                    <input
                      value={String(form.funder_note ?? "")}
                      onChange={(e) => set("funder_note", e.target.value)}
                      className="input"
                      placeholder="যেমন: ফেব্রুয়ারির ক্যাম্পেইন"
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="label">
                      কোডটি যাদের দিতে পারবে — প্রতি লাইনে একটি ফোন বা ইমেইল
                      {contactCount ? ` (${toBn(contactCount)}টি)` : ""}
                    </span>
                    <textarea
                      rows={6}
                      value={contactsText}
                      onChange={(e) => setContactsText(e.target.value)}
                      className="input resize-y font-mono text-[12px]"
                      placeholder={"01712345678\ncustomer@example.com"}
                    />
                    <span className="mt-1 flex items-center gap-1.5 text-[10.5px] text-sand-100/40">
                      {loadingContacts ? <Spinner className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                      আগে থেকে লগইন করা অ্যাকাউন্টই যোগ হবে; যে ফোন/ইমেইলে অ্যাকাউন্ট নেই সেটি
                      সেভের পর আলাদা করে দেখানো হবে
                    </span>
                  </label>
                </>
              ) : null}

              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(e) => set("is_active", e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-ink-800 accent-leaf-500"
                />
                <span className="text-[12px] text-sand-100/70">কুপন চালু আছে</span>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="btn-ghost btn-sm">বাতিল</button>
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                {saving ? <Spinner className="h-4 w-4" /> : null} সংরক্ষণ
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
