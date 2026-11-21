"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Camera,
  CheckCircle2,
  Globe,
  Loader2,
  Moon,
  Phone,
  Save,
  Sparkles,
  Sun,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { formatDateBn } from "@/lib/format";
import type { Profile } from "@/lib/profile";
import { Badge, Spinner } from "@/components/ui";

type Session = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
};

type PremiumSummary = {
  active: boolean;
  tier: string | null;
  planName: string | null;
  expiresAt: string | null;
  trialActive: boolean;
  trialMinutes: number;
};

type Tab = "details" | "preferences" | "security";

/* ==========================================================================
   ProfileForm — section C
   --------------------------------------------------------------------------
   Covers: photo upload, name, phone, bio, language, notifications,
   dark/light theme, password change, premium badge. Addresses live on their
   dedicated page (already built) and are linked from here.
   ========================================================================== */

export function ProfileForm({
  session,
  profile,
  premium,
  showWelcome,
}: {
  session: Session;
  profile: Profile | null;
  premium: PremiumSummary | null;
  showWelcome: boolean;
}) {
  const { t, locale, setLocale } = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("details");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const [welcome, setWelcome] = useState(showWelcome);

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? session.name ?? "",
    phone: profile?.phone ?? session.phone ?? "",
    bio: profile?.bio ?? "",
    language: (profile?.language ?? locale) as "bn" | "en",
    theme: (profile?.theme ?? "dark") as "dark" | "light",
    notifications: profile?.notifications ?? { email: true, push: true, sms: false },
  });
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);

  /** completeness score drives the "complete your profile" nudge */
  const completeness = useMemo(() => {
    const checks = [
      Boolean(form.full_name.trim().length > 1),
      Boolean(form.phone.trim().length > 5),
      Boolean(avatar),
      Boolean(form.bio.trim()),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form.full_name, form.phone, form.bio, avatar]);

  // theme is applied to <html> so the whole app reacts immediately
  useEffect(() => {
    document.documentElement.dataset.theme = form.theme;
  }, [form.theme]);

  const save = useCallback(
    async (patch: Record<string, unknown>, quiet = false) => {
      setSaving(true);
      setErrors({});
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json?.errors) setErrors(json.errors);
          throw new Error(json?.message ?? "সংরক্ষণ ব্যর্থ");
        }
        if (!quiet) toast.success(t("সংরক্ষণ হয়েছে", "Saved"));
        router.refresh();
        return true;
      } catch (err) {
        toast.error(t("সংরক্ষণ করা যায়নি", "Could not save"), (err as Error).message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router, t, toast]
  );

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    const ok = await save({
      full_name: form.full_name,
      phone: form.phone,
      bio: form.bio,
      language: form.language,
      theme: form.theme,
      onboarded: true,
    });
    if (ok) {
      setWelcome(false);
      setLocale(form.language);
    }
  }

  async function toggleNotification(key: "email" | "push" | "sms") {
    const next = { ...form.notifications, [key]: !form.notifications[key] };
    setForm((f) => ({ ...f, notifications: next }));
    await save({ notifications: next }, true);
    toast.success(t("নোটিফিকেশন সেটিং আপডেট হয়েছে", "Notification preference updated"));
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/profile/avatar", { method: "POST", body });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.message ?? "আপলোড ব্যর্থ");

      setAvatar(json.data.url);
      toast.success(t("ছবি আপডেট হয়েছে", "Photo updated"));
      router.refresh();
    } catch (err) {
      toast.error(t("ছবি আপলোড ব্যর্থ", "Upload failed"), (err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setUploading(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("মুছে ফেলা যায়নি");
      setAvatar(null);
      toast.success(t("ছবি সরানো হয়েছে", "Photo removed"));
      router.refresh();
    } catch (err) {
      toast.error(t("ব্যর্থ", "Failed"), (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const initial = (form.full_name || session.email || "U").trim().charAt(0).toUpperCase();
  const isAdmin = session.role === "admin";

  return (
    <div className="space-y-5">
      {/* ── welcome nudge (first visit after signup) */}
      {welcome ? (
        <div className="relative overflow-hidden rounded-2xl border border-leaf-500/30 bg-gradient-to-br from-leaf-700/25 via-ink-850 to-ink-900 p-4">
          <button
            onClick={() => setWelcome(false)}
            className="absolute right-3 top-3 text-sand-100/40 hover:text-sand-100"
            aria-label="বন্ধ করুন"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-600/25 text-leaf-200">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-leaf-100">স্বাগতম! প্রোফাইলটি সম্পূর্ণ করুন</p>
              <p className="mt-1 text-[12px] leading-relaxed text-sand-100/60">
                ছবি, মোবাইল নম্বর আর ঠিকানা যোগ করলে অর্ডার দ্রুত হবে এবং ডেলিভারি সহজ হবে।
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-leaf-400 transition-all"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-leaf-200">{completeness}% সম্পূর্ণ</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── identity card */}
      <div className="card overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-leaf-800 via-leaf-700 to-leaf-800" />
        <div className="px-4 pb-4 sm:px-5">
          <div className="-mt-9 flex items-end justify-between gap-3">
            <div className="relative">
              <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-2xl border-4 border-ink-900 bg-ink-800 text-2xl font-bold text-leaf-200">
                {avatar ? (
                  <Image
                    src={avatar}
                    alt={form.full_name || "প্রোফাইল ছবি"}
                    width={72}
                    height={72}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  initial
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-ink-900 bg-leaf-600 text-white transition hover:bg-leaf-500 disabled:opacity-60"
                aria-label={t("ছবি পরিবর্তন করুন", "Change photo")}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file);
                }}
              />
            </div>

            <div className="flex items-center gap-2 pb-1">
              {avatar ? (
                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={uploading}
                  className="rounded-lg px-2 py-1 text-[11px] text-sand-100/45 transition hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="mr-1 inline h-3 w-3" />
                  {t("সরান", "Remove")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-bold">{form.full_name || session.email || "গ্রাহক"}</h2>
            {isAdmin ? (
              <Badge tone="amber">অ্যাডমিন</Badge>
            ) : profile?.role === "seller" ? (
              <Badge tone="neutral">সেলার</Badge>
            ) : null}
            {premium?.active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-400/20 px-2 py-0.5 text-[10.5px] font-bold text-amber-200 ring-1 ring-amber-400/30">
                <BadgeCheck className="h-3 w-3" />
                প্রিমিয়াম
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 text-[12px] text-sand-100/45">{session.email}</p>

          {/* premium status line */}
          {premium?.active ? (
            <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2">
              <p className="text-[12px] font-semibold text-amber-100">
                {premium.planName ?? (premium.trialActive ? "ফ্রি ট্রায়াল" : "প্রিমিয়াম প্ল্যান")}
                {premium.tier ? ` · ${premium.tier}` : ""}
              </p>
              <p className="mt-0.5 text-[11px] text-amber-100/60">
                {premium.expiresAt
                  ? `মেয়াদ শেষ: ${formatDateBn(premium.expiresAt)}`
                  : premium.trialActive
                    ? `আর ${premium.trialMinutes} মিনিট বাকি`
                    : ""}
              </p>
              <Link
                href="/account/premium"
                className="mt-1 inline-block text-[11px] font-semibold text-amber-200 hover:underline"
              >
                প্রিমিয়াম বিস্তারিত →
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[12px] text-sand-100/55">
                {premium?.trialActive
                  ? `ফ্রি ট্রায়াল চলছে — আর ${premium.trialMinutes} মিনিট`
                  : "লাইভ খামার ক্যামেরা দেখতে প্রিমিয়াম নিন"}
              </p>
              <Link href="/live/plans" className="mt-1 inline-block text-[11px] font-semibold text-leaf-300 hover:underline">
                প্ল্যান দেখুন →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── tabs */}
      <div className="flex gap-1 rounded-full border border-white/[0.07] bg-ink-850/70 p-1">
        {(
          [
            { key: "details", label: t("তথ্য", "Details") },
            { key: "preferences", label: t("সেটিংস", "Preferences") },
            { key: "security", label: t("নিরাপত্তা", "Security") },
          ] as { key: Tab; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex-1 rounded-full px-3 py-2 text-[12.5px] font-semibold transition ${
              tab === item.key ? "bg-leaf-600 text-white" : "text-sand-100/60 hover:text-sand-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ── details */}
      {tab === "details" ? (
        <form onSubmit={submitDetails} className="card space-y-4 p-4 sm:p-5">
          <label className="block">
            <span className="label">{t("পুরো নাম", "Full name")}</span>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
              <input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="input !pl-10"
                placeholder={t("রফিকুল ইসলাম", "Rafiqul Islam")}
                autoComplete="name"
              />
            </div>
            {errors.full_name ? <p className="mt-1 text-[11px] text-red-300">{errors.full_name}</p> : null}
          </label>

          <label className="block">
            <span className="label">{t("মোবাইল নম্বর", "Mobile number")}</span>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="input !pl-10"
                placeholder="01712345678"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            {errors.phone ? <p className="mt-1 text-[11px] text-red-300">{errors.phone}</p> : null}
          </label>

          <label className="block">
            <span className="label">
              {t("বায়ো", "Bio")}{" "}
              <span className="ml-1 text-[10px] text-sand-100/30">({form.bio.length}/400)</span>
            </span>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, 400) }))}
              className="input min-h-[80px] resize-y"
              placeholder={t("নিজের সম্পর্কে সংক্ষেপে লিখুন", "Tell us a little about yourself")}
            />
          </label>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[12px] font-semibold">সংরক্ষিত ঠিকানা</p>
            <p className="mt-0.5 text-[11px] text-sand-100/45">
              বিভাগ → জেলা → উপজেলা অনুযায়ী ঠিকানা যোগ করুন
            </p>
            <Link href="/account/addresses" className="btn-ghost mt-2 !px-3 !py-1.5 !text-[11.5px]">
              ঠিকানা ম্যানেজ করুন →
            </Link>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? <Spinner /> : <Save className="h-4 w-4" />}
            {t("সংরক্ষণ করুন", "Save changes")}
          </button>

          {completeness < 100 ? (
            <p className="text-center text-[11px] text-sand-100/40">
              প্রোফাইল {completeness}% সম্পূর্ণ — ছবি ও ঠিকানা যোগ করলে ১০০% হবে
            </p>
          ) : (
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-leaf-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> প্রোফাইল সম্পূর্ণ
            </p>
          )}
        </form>
      ) : null}

      {/* ── preferences */}
      {tab === "preferences" ? (
        <div className="space-y-4">
          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-leaf-300" />
              <h3 className="text-[13.5px] font-semibold">{t("ভাষা", "Language")}</h3>
            </div>
            <p className="mt-1 text-[11.5px] text-sand-100/45">
              সাইটের ভাষা ও প্রোফাইলের ডিফল্ট ভাষা
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  { value: "bn", label: "বাংলা" },
                  { value: "en", label: "English" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, language: opt.value }));
                    setLocale(opt.value);
                    save({ language: opt.value }, true);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
                    form.language === opt.value
                      ? "border-leaf-500 bg-leaf-600/20 text-leaf-100"
                      : "border-white/10 text-sand-100/60 hover:border-white/20"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              {form.theme === "dark" ? (
                <Moon className="h-4 w-4 text-leaf-300" />
              ) : (
                <Sun className="h-4 w-4 text-amber-300" />
              )}
              <h3 className="text-[13.5px] font-semibold">{t("থিম", "Theme")}</h3>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  { value: "dark", label: t("ডার্ক", "Dark"), Icon: Moon },
                  { value: "light", label: t("লাইট", "Light"), Icon: Sun },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, theme: opt.value }));
                    save({ theme: opt.value }, true);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
                    form.theme === opt.value
                      ? "border-leaf-500 bg-leaf-600/20 text-leaf-100"
                      : "border-white/10 text-sand-100/60 hover:border-white/20"
                  }`}
                >
                  <opt.Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-leaf-300" />
              <h3 className="text-[13.5px] font-semibold">{t("নোটিফিকেশন", "Notifications")}</h3>
            </div>
            <div className="mt-3 space-y-2">
              {(
                [
                  { key: "email", label: t("ইমেইল", "Email"), desc: t("অর্ডার ও অফার", "Orders and offers") },
                  { key: "push", label: t("পুশ", "Push"), desc: t("ব্রাউজার/অ্যাপ নোটিফিকেশন", "Browser & app alerts") },
                  { key: "sms", label: t("SMS", "SMS"), desc: t("শুধু গুরুত্বপূর্ণ আপডেট", "Critical updates only") },
                ] as const
              ).map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => toggleNotification(row.key)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2.5 text-left transition hover:border-white/15"
                >
                  <span>
                    <span className="block text-[12.5px] font-medium">{row.label}</span>
                    <span className="block text-[11px] text-sand-100/40">{row.desc}</span>
                  </span>
                  <span
                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                      form.notifications[row.key] ? "bg-leaf-500" : "bg-white/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                        form.notifications[row.key] ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── security */}
      {tab === "security" ? <SecurityPanel /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- security */
function SecurityPanel() {
  const { t } = useLocale();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (next !== confirm) {
      setErrors({ confirm: "নতুন পাসওয়ার্ড দুইবার একই দিতে হবে" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.errors) setErrors(json.errors);
        throw new Error(json?.message ?? "পাসওয়ার্ড পরিবর্তন ব্যর্থ");
      }
      toast.success(t("পাসওয়ার্ড পরিবর্তন হয়েছে", "Password changed"));
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(t("পরিবর্তন ব্যর্থ", "Change failed"), (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5">
      <div>
        <h3 className="text-[13.5px] font-semibold">পাসওয়ার্ড পরিবর্তন</h3>
        <p className="mt-0.5 text-[11.5px] text-sand-100/45">
          কমপক্ষে ৮ অক্ষর — সংখ্যা ও বড় হাতের অক্ষর মিশিয়ে দিন
        </p>
      </div>

      <label className="block">
        <span className="label">বর্তমান পাসওয়ার্ড</span>
        <input
          required
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="input"
          autoComplete="current-password"
        />
        {errors.currentPassword ? (
          <p className="mt-1 text-[11px] text-red-300">{errors.currentPassword}</p>
        ) : null}
      </label>

      <label className="block">
        <span className="label">নতুন পাসওয়ার্ড</span>
        <input
          required
          type="password"
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="input"
          autoComplete="new-password"
        />
        {errors.newPassword ? <p className="mt-1 text-[11px] text-red-300">{errors.newPassword}</p> : null}
      </label>

      <label className="block">
        <span className="label">নতুন পাসওয়ার্ড (আবার)</span>
        <input
          required
          type="password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input"
          autoComplete="new-password"
        />
        {errors.confirm ? <p className="mt-1 text-[11px] text-red-300">{errors.confirm}</p> : null}
      </label>

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? <Spinner /> : <Save className="h-4 w-4" />}
        পাসওয়ার্ড পরিবর্তন করুন
      </button>

      <Link
        href="/account/security"
        className="block text-center text-[12px] text-sand-100/45 hover:text-leaf-200"
      >
        টু-স্টেপ যাচাই ও সেশন সেটিংস →
      </Link>
    </form>
  );
}
