"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Save, ShieldCheck } from "lucide-react";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   components/admin/settings-manager.tsx — সাইট সেটিংস
   --------------------------------------------------------------------------
   A typed form over the `settings` key/value table. Every field here is read
   by running code, so the labels spell out the consequence, not the column
   name: "ঢাকার ভেতরে ৬০ টাকা" not "inside_dhaka".

   Grouped by consequence rather than by table row, because the owner thinks
   "I want cheaper delivery", not "I want the delivery object".

   Numbers are sent as numbers. The API merges shallowly, so a field left alone
   in one tab cannot wipe a field the owner set in another.
   ========================================================================== */

type Values = Record<string, Record<string, unknown>>;

type Field = {
  /** dotted path: "delivery.inside_dhaka" */
  path: string;
  label: string;
  hint?: string;
  type: "number" | "text" | "boolean" | "textarea" | "select";
  suffix?: string;
  /** for `select`: the fixed choices (the stored value is the `value`) */
  options?: { value: string; label: string }[];
};

type Group = {
  key: string;
  title: string;
  desc: string;
  fields: Field[];
};

const GROUPS: Group[] = [
  {
    key: "delivery",
    title: "ডেলিভারি চার্জ",
    desc: "চেকআউটে এই সংখ্যাগুলোই যোগ হয়।",
    fields: [
      { path: "delivery.inside_dhaka", label: "ঢাকার ভেতরে", type: "number", suffix: "৳" },
      { path: "delivery.outside_dhaka", label: "ঢাকার বাইরে", type: "number", suffix: "৳" },
      {
        path: "delivery.free_over",
        label: "এই টাকার বেশি অর্ডারে ফ্রি",
        type: "number",
        suffix: "৳",
      },
    ],
  },
  {
    key: "premium",
    title: "প্রিমিয়াম ও লাইভ ক্যামেরা",
    desc: "ট্রায়ালের দৈর্ঘ্য ও একসাথে কতজন দেখতে পারবেন।",
    fields: [
      {
        path: "premium.trial_minutes",
        label: "ফ্রি ট্রায়াল",
        type: "number",
        suffix: "মিনিট",
      },
      { path: "premium.grace_days", label: "মেয়াদ শেষে গ্রেস", type: "number", suffix: "দিন" },
      {
        path: "premium.default_device_limit",
        label: "প্ল্যানে ডিফল্ট ডিভাইস",
        type: "number",
      },
      {
        path: "premium.max_viewers_per_camera",
        label: "প্রতি ক্যামেরায় সর্বোচ্চ দর্শক",
        type: "number",
      },
    ],
  },
  {
    key: "seller",
    title: "সেলার ও কমিশন",
    desc: "মার্কেটপ্লেসে নতুন সেলার কীভাবে যোগ হবে।",
    fields: [
      {
        path: "seller.default_commission_percent",
        label: "ডিফল্ট কমিশন",
        type: "number",
        suffix: "%",
      },
      {
        path: "seller.auto_approve",
        label: "সেলার আবেদন নিজে থেকেই অনুমোদন হবে",
        hint: "বন্ধ রাখলে আপনাকে অনুমোদন করতে হবে — নিরাপদ।",
        type: "boolean",
      },
    ],
  },
  {
    key: "auth",
    title: "লগইন নিরাপত্তা",
    desc: "অ্যাডমিন প্যানেলে ভুল পাসওয়ার্ড দিলে কী হবে।",
    fields: [
      { path: "auth.max_failed_logins", label: "কতবার ভুল পাসওয়ার্ড চলবে", type: "number" },
      { path: "auth.lockout_minutes", label: "লকআউট", type: "number", suffix: "মিনিট" },
      {
        path: "auth.admin_session_hours",
        label: "অ্যাডমিন সেশন",
        type: "number",
        suffix: "ঘণ্টা",
      },
      {
        path: "auth.require_admin_mfa",
        label: "2FA বাধ্যতামূলক",
        hint: "প্রস্তাবিত। চালু করলে অ্যাডমিনকে TOTP কোড দিতে হবে।",
        type: "boolean",
      },
    ],
  },
  {
    key: "reviews",
    title: "রিভিউ",
    desc: "গ্রাহকের রিভিউ সাথে সাথে প্রকাশিত হয় — অনুমোদনের দরকার নেই। চাইলে রিভিউ পেজ থেকে লুকানো বা মুছে ফেলা যায়।",
    fields: [
      { path: "reviews.max_photos", label: "সর্বোচ্চ ছবি", type: "number" },
      { path: "reviews.edit_window_days", label: "রিভিউ সম্পাদনার সময়", type: "number", suffix: "দিন" },
      { path: "reviews.low_rating_threshold", label: "এই রেটিং হলে সতর্ক হোন", type: "number", suffix: "★" },
    ],
  },
  {
    key: "referral",
    title: "রেফারেল ও ওয়ালেট",
    desc: "বন্ধুকে রেফার করলে তার অর্ডার থেকে কত % বোনাস, আর ওয়ালেটে জমা টাকা দিয়ে একটি অর্ডারের সর্বোচ্চ কত % দেওয়া যাবে — দুটোই এখান থেকে।",
    fields: [
      {
        path: "referral.enabled",
        label: "রেফারেল চালু",
        type: "boolean",
        hint: "বন্ধ করলে নতুন কেউ রেফার কোড নিতে পারবে না, আগের ব্যালেন্স ব্যবহারযোগ্য থাকবে।",
      },
      {
        path: "referral.commission_percent",
        label: "ইনভাইটের অর্ডারে বোনাস",
        type: "number",
        suffix: "%",
        hint: "৫ থেকে ১০% — ছাড়ের পর নয়, পণ্যের দামের ওপর হিসাব হয়।",
      },
      {
        path: "referral.wallet_max_percent",
        label: "একটি অর্ডারে ওয়ালেট সর্বোচ্চ",
        type: "number",
        suffix: "%",
        hint: "২০–৩০% রাখাই নিয়ম — বাকিটা গ্রাহক স্বাভাবিকভাবে পরিশোধ করবে।",
      },
      {
        path: "referral.min_order",
        label: "বোনাসের জন্য ন্যূনতম অর্ডার",
        type: "number",
        suffix: "৳",
      },
      {
        path: "referral.credit_on",
        label: "বোনাস কখন জমা হবে",
        type: "select",
        options: [
          { value: "delivered", label: "ডেলিভারি সম্পন্ন হলে" },
          { value: "paid", label: "পেমেন্ট নিশ্চিত হলে" },
        ],
        hint: "ডেলিভারির পরই সবচেয়ে নিরাপদ — ফেরত গেলে বোনাস যাবে না।",
      },
    ],
  },
  {
    key: "store",
    title: "দোকানের পরিচিতি ও যোগাযোগ",
    desc: "ওয়েবসাইটের হেডার, মেনু, ফুটার, যোগাযোগ পাতা, অর্ডার পাতা ও শিপিং লেবেলে এই তথ্যই দেখায়।",
    fields: [
      { path: "store.name", label: "দোকানের নাম (বাংলা)", type: "text" },
      { path: "store.name_en", label: "দোকানের নাম (English)", type: "text" },
      { path: "store.email", label: "ইমেইল", type: "text" },
      { path: "store.phone", label: "ফোন নম্বর (কলের জন্য)", type: "text", hint: "যেমন +8801712345678 — এটা দিয়ে কল বাটন কাজ করে।" },
      { path: "store.phone_display", label: "ফোন নম্বর (যেটা দেখাবে)", type: "text", hint: "খালি রাখলে উপরের নম্বর থেকে নিজে থেকে বানিয়ে নেয়।" },
      { path: "store.whatsapp", label: "হোয়াটসঅ্যাপ নম্বর", type: "text", hint: "শুধু সংখ্যা — যেমন 8801712345678" },
      { path: "store.address_bn", label: "ঠিকানা (বাংলা)", type: "textarea" },
      { path: "store.address_en", label: "ঠিকানা (English)", type: "textarea" },
      { path: "store.hours_bn", label: "খোলার সময় (বাংলা)", type: "text", hint: "যেমন: প্রতিদিন সকাল ৭টা — রাত ১০টা" },
      { path: "store.hours_en", label: "খোলার সময় (English)", type: "text" },
      { path: "store.map_embed", label: "গুগল ম্যাপ এমবেড লিংক", type: "text", hint: "Google Maps → Share → Embed a map → লিংকটি পেস্ট করুন।" },
    ],
  },
];

/** Read a dotted path out of the nested settings map. */
function read(values: Values, path: string): unknown {
  const [key, field] = path.split(".");
  return values[key]?.[field];
}

export function SettingsManager({ initial }: { initial: Values }) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [values, setValues] = useState<Values>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  /** Dotted paths whose local value differs from the server value. */
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  function set(path: string, next: unknown) {
    const [key, field] = path.split(".");
    setValues((current) => ({ ...current, [key]: { ...current[key], [field]: next } }));
    setDirty((current) => new Set(current).add(path));
  }

  async function saveGroup(group: Group) {
    /* Only the touched fields are sent — the API merges, so everything else
       stays exactly as it was on the server. */
    const patch: Record<string, unknown> = {};
    for (const field of group.fields) {
      if (!dirty.has(field.path)) continue;
      const [key, name] = field.path.split(".");
      const value = values[key]?.[name];
      patch[name] = field.type === "number" ? Number(value) : value;
    }

    if (!Object.keys(patch).length) {
      errorToast("কিছু বদলানো হয়নি", "আগে একটি মান বদলান");
      return;
    }

    /* Refuse an empty or negative number before it reaches the server: a
       `free_over: 0` would make every order free, and NaN breaks the maths. */
    for (const [name, value] of Object.entries(patch)) {
      if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
        errorToast("সংখ্যাটি ঠিক নয়", `${name} ঋণাত্মক বা ফাঁকা হতে পারবে না`);
        return;
      }
    }

    setBusy(group.key);
    try {
      const res = await fetch("/api/foisal/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: group.key, value: patch }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("সেভ হয়নি", json?.message);
        return;
      }

      success("সেভ হয়েছে", `${group.title} — সাইটে সাথে সাথে কার্যকর`);
      setDirty((current) => {
        const next = new Set(current);
        for (const field of group.fields) next.delete(field.path);
        return next;
      });
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setBusy(null);
    }
  }

  const dirtyIn = (group: Group) => group.fields.filter((f) => dirty.has(f.path)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <p className="text-[11.5px] leading-relaxed text-amber-100/80">
          এই পাতার প্রতিটি পরিবর্তন <b>সাথে সাথে</b> সাইটে কার্যকর হয় — ডিপ্লয় লাগে না।
          প্রতিটি সেভ <b>অডিট লগে</b> লেখা থাকে: কে, কখন, কী বদলেছে।
        </p>
      </div>

      {GROUPS.map((group) => {
        const count = dirtyIn(group);
        return (
          <section key={group.key} className="card overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
              <div>
                <h2 className="text-[13.5px] font-bold">{group.title}</h2>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-sand-100/45">{group.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => saveGroup(group)}
                disabled={busy === group.key}
                className="btn-primary btn-sm shrink-0"
              >
                {busy === group.key ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {count ? `সেভ (${count})` : "সেভ"}
              </button>
            </header>

            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              {group.fields.map((field) => {
                const value = read(values, field.path);
                return (
                  <label
                    key={field.path}
                    className={`block space-y-1 ${
                      field.type === "textarea" || field.path === "store.map_embed" ? "sm:col-span-2" : ""
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2 text-[11.5px] font-medium text-sand-100/70">
                      <span>{field.label}</span>
                      {field.suffix ? (
                        <span className="text-[10px] text-sand-100/35">{field.suffix}</span>
                      ) : null}
                    </span>

                    {field.type === "boolean" ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(value)}
                        onClick={() => set(field.path, !value)}
                        className={`flex min-h-[38px] w-full items-center justify-between rounded-xl border px-3 text-[12px] transition ${
                          value
                            ? "border-leaf-500/40 bg-leaf-600/15 text-leaf-100"
                            : "border-white/10 bg-white/[0.03] text-sand-100/50"
                        }`}
                      >
                        <span>{value ? "চালু" : "বন্ধ"}</span>
                        <span
                          className={`h-3.5 w-6 rounded-full transition ${value ? "bg-leaf-400" : "bg-white/15"}`}
                        >
                          <span
                            className={`block h-3 w-3 translate-y-[1px] rounded-full bg-white shadow-neu-xs transition ${
                              value ? "translate-x-[11px]" : "translate-x-[1px]"
                            }`}
                          />
                        </span>
                      </button>
                    ) : field.type === "select" ? (
                      <select
                        className="inp min-h-[38px]"
                        value={value === undefined || value === null ? "" : String(value)}
                        onChange={(e) => set(field.path, e.target.value)}
                      >
                        {field.options?.map((o) => (
                          <option key={o.value} value={o.value} className="bg-ink-800">
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        className="inp min-h-[72px] resize-y py-2"
                        rows={2}
                        value={value === undefined || value === null ? "" : String(value)}
                        onChange={(e) => set(field.path, e.target.value)}
                      />
                    ) : (
                      <input
                        className="inp min-h-[38px]"
                        type={field.type === "number" ? "number" : "text"}
                        inputMode={field.type === "number" ? "numeric" : undefined}
                        min={field.type === "number" ? 0 : undefined}
                        value={value === undefined || value === null ? "" : String(value)}
                        onChange={(e) =>
                          set(
                            field.path,
                            field.type === "number" ? Number(e.target.value) : e.target.value
                          )
                        }
                      />
                    )}

                    {field.hint ? (
                      <span className="flex items-start gap-1 text-[10.5px] leading-relaxed text-sand-100/35">
                        <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden />
                        {field.hint}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
