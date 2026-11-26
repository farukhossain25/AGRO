"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn, money, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { ImageField } from "@/components/admin/image-field";

export type Field = {
  name: string;
  label: string;
  type:
    | "text"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "date"
    | "image"
    /** combo contents: "name | qty" per line → jsonb [{name, qty}] */
    | "lines"
    /** one item per line → text[] (features, bullet lists) */
    | "array"
    /** "label | min | max" per line → members_label / members_min / members_max */
    | "members";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  colSpan?: 1 | 2;
};

/**
 * Cells are described declaratively (never with functions) because this file is
 * a Client Component and Server Components cannot pass functions across the
 * boundary.
 *
 *   format: how to render `key`
 *   subKey / subPrefix: second line for "stack"
 *   trueLabel / falseLabel: labels for "badge"
 */
export type Column = {
  key: string;
  label: string;
  format?:
    | "text"
    | "money"
    | "number"
    | "code"
    | "icon"
    | "date"
    | "stack"
    | "badge"
    | "coupon_value"
    | "usage"
    | "scope"
    | "link"
    /** small square image (value = url) */
    | "thumb"
    /** "Nটি" — the length of an array value */
    | "count";
  subKey?: string;
  subPrefix?: string;
  trueLabel?: string;
  falseLabel?: string;
  /** for plain text: display labels for stored values (e.g. daily → ডেইলি) */
  map?: Record<string, string>;
  /** for "link": the anchor text (the cell value is the href) */
  linkLabel?: string;
  /** for "link": build the href from the value, e.g. "/combos/{v}" */
  linkPath?: string;
  /** for "link": open in a new tab (default true) */
  external?: boolean;
  /** keep short values (status, dates, counts) on one line; the table scrolls instead */
  nowrap?: boolean;
};

const GREEN = "bg-leaf-600/20 text-leaf-700";
const MUTED = "bg-white/[0.07] text-sand-100/50";

function Cell({ row, col }: { row: Record<string, unknown>; col: Column }) {
  const raw = row[col.key];
  const label = (r: Record<string, unknown>) => String(r.id);

  switch (col.format) {
    case "icon":
      return <span className="text-lg">{String(raw ?? "🌿")}</span>;

    case "money":
      // null is "not set" (e.g. no original price) — not zero taka
      return <>{raw === null || raw === undefined || raw === "" ? "—" : money(Number(raw), true)}</>;

    case "number":
      return <>{toBn(Number(raw ?? 0))}</>;

    case "code":
      return <span className="font-mono text-[10.5px] text-leaf-200">{String(raw ?? "—")}</span>;

    case "date":
      return <span className="whitespace-nowrap text-[11px]">{raw ? formatDateBn(String(raw)) : "—"}</span>;

    case "stack":
      return (
        <div>
          <p className="line-clamp-1 font-medium">{String(raw ?? "—")}</p>
          {col.subKey ? (
            <p className="truncate text-[9.5px] text-sand-100/35">
              {col.subPrefix ?? ""}
              {String(row[col.subKey] ?? "")}
            </p>
          ) : null}
        </div>
      );

    case "badge":
      return (
        <span className={`badge !text-[9px] ${raw ? GREEN : MUTED}`}>
          {raw ? (col.trueLabel ?? "সক্রিয়") : (col.falseLabel ?? "নিষ্ক্রিয়")}
        </span>
      );

    case "coupon_value":
      return <>{row.type === "percent" ? `${toBn(Number(raw ?? 0))}%` : money(Number(raw ?? 0), true)}</>;

    case "usage":
      return (
        <>
          {toBn(Number(row.used_count ?? 0))}
          <span className="text-sand-100/35">/{raw ? toBn(Number(raw)) : "∞"}</span>
        </>
      );

    case "scope":
      return (
        <span className={`badge !text-[9px] ${raw === "inside_dhaka" ? GREEN : "bg-white/[0.07] text-sand-100/60"}`}>
          {raw === "inside_dhaka" ? "ঢাকার ভেতরে" : "ঢাকার বাইরে"}
        </span>
      );

    case "thumb":
      return raw ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin may paste any host
        <img src={String(raw)} alt="" className="h-9 w-12 rounded-lg bg-white object-cover ring-1 ring-black/10" />
      ) : (
        <span className="grid h-9 w-12 place-items-center rounded-lg bg-white/[0.07] text-sand-100/30">—</span>
      );

    case "count":
      return <>{toBn(Array.isArray(raw) ? raw.length : 0)}টি</>;

    case "link":
      return raw ? (
        <a
          href={col.linkPath ? col.linkPath.replace("{v}", String(raw)) : String(raw)}
          target={col.external === false ? undefined : "_blank"}
          rel={col.external === false ? undefined : "noopener noreferrer"}
          className="text-leaf-300 underline-offset-2 hover:text-leaf-200 hover:underline"
        >
          {col.linkLabel ?? String(raw)}
        </a>
      ) : (
        <>—</>
      );

    default:
      return (
        <>
          {raw === null || raw === undefined || raw === "" ? "—" : label(row) && String(col.map?.[String(raw)] ?? raw)}
        </>
      );
  }
}

/**
 * Family-size band of a monthly food plan, edited as ONE control.
 *
 * WHY NOT TWO NUMBER INPUTS
 *   `members_label` is the text the customer reads ("৪-৫ জন"), while
 *   `members_min` / `members_max` are what the order actually validates
 *   against. Typed separately they drift ("৮-১০ জন" with max 6), and a customer
 *   then gets an error they cannot act on. The label here is derived from the
 *   numbers whenever they change, and the admin can still type a custom label
 *   (e.g. "৪-৬ জন (বড় পরিবার)").
 */
function MembersField({
  label,
  min,
  max,
  hint,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  hint?: string;
  onChange: (next: { label: string; min: number; max: number }) => void;
}) {
  const [custom, setCustom] = useState(false);
  const auto = `${toBn(min)}-${toBn(max)} জন`;

  return (
    <div>
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[10.5px] text-sand-100/40">সর্বনিম্ন সদস্য</span>
          <input
            type="number"
            min={1}
            max={30}
            value={min}
            onChange={(e) => {
              const next = Math.max(1, Math.min(30, Number(e.target.value) || 1));
              onChange({ label: custom ? label : `${toBn(next)}-${toBn(Math.max(next, max))} জন`, min: next, max: Math.max(next, max) });
            }}
            className="input"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[10.5px] text-sand-100/40">সর্বোচ্চ সদস্য</span>
          <input
            type="number"
            min={1}
            max={30}
            value={max}
            onChange={(e) => {
              const next = Math.max(1, Math.min(30, Number(e.target.value) || 1));
              onChange({ label: custom ? label : `${toBn(Math.min(next, min))}-${toBn(next)} জন`, min: Math.min(next, min), max: next });
            }}
            className="input"
          />
        </label>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => {
            setCustom(true);
            onChange({ label: e.target.value, min, max });
          }}
          onFocus={() => setCustom(true)}
          className="input"
          placeholder={auto}
        />
        {custom ? (
          <button
            type="button"
            onClick={() => {
              setCustom(false);
              onChange({ label: auto, min, max });
            }}
            className="shrink-0 rounded-lg border border-white/10 px-2 py-1.5 text-[10.5px] text-sand-100/60 hover:bg-white/5"
          >
            স্বয়ংক্রিয়
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-sand-100/40">
        {hint ?? "কাস্টমার এই লেখাটি দেখবে (যেমন “৪-৫ জন”)। সংখ্যা বদলালে লেখাটি নিজেই বদলে যাবে।"}
      </p>
    </div>
  );
}

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
      const res = await fetch(`/api/foisal/${resource}`, {
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
      const res = await fetch(`/api/foisal/${resource}?id=${id}`, { method: "DELETE" });
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
                  <th key={c.key} className="whitespace-nowrap px-3 py-2.5 font-medium">{c.label}</th>
                ))}
                <th className="px-3 py-2.5 text-right font-medium">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-white/[0.02]">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2.5 ${c.nowrap ? "whitespace-nowrap" : ""}`}>
                      <Cell row={row} col={c} />
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
                /* An image field carries its own upload button and file input,
                   so it must not sit inside a <label> (a click would open the
                   picker twice). Everything else stays a label for a11y. */
                const Wrapper = f.type === "image" ? "div" : "label";
                return (
                  <Wrapper key={f.name} className={f.colSpan === 2 ? "sm:col-span-2" : ""}>
                    {/* ImageField brings its own label; the others get one here */}
                    {f.type !== "image" ? <span className="label">{f.label}{f.required ? " *" : ""}</span> : null}
                    {f.type === "image" ? (
                      <ImageField
                        value={String(value ?? "")}
                        onChange={set}
                        label={`${f.label}${f.required ? " *" : ""}`}
                        hint={f.hint}
                        ratio="banner"
                        allowUrl
                      />
                    ) : f.type === "lines" ? (
                      <textarea
                        rows={5}
                        value={Array.isArray(value)
                          ? (value as { name?: string; qty?: string }[]).map((l) => [l.name, l.qty].filter(Boolean).join(" | ")).join("\n")
                          : String(value ?? "")}
                        onChange={(e) =>
                          set(
                            e.target.value
                              .split("\n")
                              .map((l) => l.trim())
                              .filter(Boolean)
                              .map((l) => {
                                const [name, ...rest] = l.split("|");
                                return { name: (name ?? "").trim(), qty: rest.join("|").trim() || "১টি" };
                              })
                          )
                        }
                        className="input resize-y font-[inherit]"
                        placeholder={f.placeholder}
                      />
                    ) : f.type === "array" ? (
                      /* text[] columns (subscription_plans.features). One item
                         per line; blank lines are dropped, order is kept. */
                      <textarea
                        rows={5}
                        value={
                          Array.isArray(value)
                            ? (value as unknown[]).map((v) => String(v)).join("\n")
                            : String(value ?? "")
                        }
                        onChange={(e) =>
                          set(
                            e.target.value
                              .split("\n")
                              .map((l) => l.trim())
                              .filter(Boolean)
                          )
                        }
                        className="input resize-y"
                        placeholder={f.placeholder ?? "প্রতি লাইনে একটি করে"}
                      />
                    ) : f.type === "members" ? (
                      /* The plan's family-size band. The storefront prints the
                         label; place_order validates against min/max, so all
                         three have to be edited together or they drift apart. */
                      <MembersField
                        label={String(form?.members_label ?? "")}
                        min={Number(form?.members_min ?? 1)}
                        max={Number(form?.members_max ?? 10)}
                        hint={f.hint}
                        onChange={(next) => {
                          setForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  members_label: next.label,
                                  members_min: next.min,
                                  members_max: next.max,
                                }
                              : prev
                          );
                        }}
                      />
                    ) : f.type === "textarea" ? (
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
                    {f.hint && f.type !== "checkbox" && f.type !== "image" ? (
                      <p className="mt-1 text-[10.5px] leading-relaxed text-sand-100/40">{f.hint}</p>
                    ) : null}
                    {errors[f.name] ? <p className="mt-1 text-[11px] text-red-300">{errors[f.name]}</p> : null}
                  </Wrapper>
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
