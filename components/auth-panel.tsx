"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase-browser";
import { GoogleButton, OrDivider } from "./google-button";
import { Spinner } from "./ui";

type Mode = "login" | "register" | "otp" | "reset" | "forgot";

/* Reasons the PKCE callback (app/auth/callback/route.ts) can bounce back with.
   Keeping them here means the user sees a sentence, not a code, and the list
   cannot drift from the route without a type error on the FailReason union. */
const CALLBACK_ERRORS: Record<string, { bn: string; en: string }> = {
  not_configured: {
    bn: "Supabase Auth কনফিগার করা নেই — অ্যাডমিনকে জানান।",
    en: "Supabase Auth is not configured — please tell the admin.",
  },
  no_code: {
    bn: "লগইন বাতিল হয়েছে বা লিঙ্কের মেয়াদ শেষ। আবার চেষ্টা করুন।",
    en: "Sign-in was cancelled or the link expired. Please try again.",
  },
  exchange_failed: {
    bn: "Google লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।",
    en: "Google sign-in did not complete. Please try again.",
  },
  email_unverified: {
    bn: "ইমেইল এখনো যাচাই হয়নি — ইনবক্সের লিঙ্কে ক্লিক করুন।",
    en: "Email not verified yet — click the link in your inbox.",
  },
  profile_failed: {
    bn: "প্রোফাইল তৈরি করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    en: "Could not create your profile. Please try again shortly.",
  },
  unexpected: {
    bn: "অপ্রত্যাশিত সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    en: "Something unexpected happened. Please try again.",
  },
};

export function AuthPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useLocale();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "register" ? "register" : "login");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const redirectTo = params.get("next") || "/account";

  useEffect(() => {
    setErrors({});
    setDevCode(null);
  }, [mode]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.errors) setErrors(json.errors);
      throw new Error(json.message ?? "সমস্যা হয়েছে");
    }
    return json.data;
  }

  /** Hand a Supabase session to the server so it can mint the app cookie. */
  async function exchange(accessToken: string, remember = true) {
    const res = await fetch("/api/auth/supabase/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, remember }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      if (json?.errors) setErrors(json.errors);
      throw new Error(json?.message ?? "লগইন সম্পন্ন করা যায়নি");
    }
    return json.data;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setNotice(null);

    const looksLikeEmail = identifier.includes("@");

    // ── primary path: Supabase Auth (email + password)
    if (supabaseConfigured && looksLikeEmail) {
      try {
        const client = supabaseBrowser();
        const { data, error } = await client.auth.signInWithPassword({
          email: identifier.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        if (!data.session) throw new Error("সেশন পাওয়া যায়নি — আবার চেষ্টা করুন");

        await exchange(data.session.access_token, true);
        toast.success(t("লগইন সফল", "Signed in"));
        router.push(redirectTo);
        router.refresh();
        return;
      } catch (err) {
        const msg = (err as Error).message;

        // Unconfirmed email → offer to resend instead of a dead end.
        if (/confirm/i.test(msg)) {
          setNotice(msg);
          toast.info(t("ইমেইল যাচাই বাকি", "Email not verified"), msg);
          setLoading(false);
          return;
        }

        // Fall through to the legacy bcrypt path (accounts created before the
        // Supabase Auth migration) rather than blocking a valid login.
        if (!/invalid login credentials|invalid_credentials/i.test(msg)) {
          toast.error(t("লগইন ব্যর্থ", "Sign-in failed"), msg);
          setLoading(false);
          return;
        }
      }
    }

    // ── fallback path: legacy bcrypt login (phone numbers + pre-migration rows)
    try {
      await post("/api/auth/login", { identifier, password });
      toast.success(t("লগইন সফল", "Signed in"));
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error(t("লগইন ব্যর্থ", "Sign-in failed"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!identifier.includes("@")) return;
    try {
      const { error } = await supabaseBrowser().auth.resend({
        type: "signup",
        email: identifier.trim().toLowerCase(),
      });
      if (error) throw error;
      toast.success(t("যাচাই লিঙ্ক আবার পাঠানো হয়েছে", "Verification link resent"));
    } catch (err) {
      toast.error(t("পাঠানো যায়নি", "Could not resend"), (err as Error).message);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      if (!supabaseConfigured) throw new Error("Supabase Auth কনফিগার করা নেই");
      if (!identifier.includes("@")) {
        throw new Error("পাসওয়ার্ড রিসেটের জন্য ইমেইল দিন");
      }
      const { error } = await supabaseBrowser().auth.resetPasswordForEmail(
        identifier.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/callback?next=/account/security&type=recovery` }
      );
      if (error) throw error;
      setResetSent(true);
      toast.success(
        t("রিসেট লিঙ্ক পাঠানো হয়েছে", "Reset link sent"),
        t("ইমেইল চেক করুন (স্প্যাম ফোল্ডারও দেখুন)", "Check your inbox and spam folder")
      );
    } catch (err) {
      toast.error(t("পাঠানো যায়নি", "Could not send"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setNotice(null);

    // ── primary: Supabase Auth signup (sends a verification email)
    if (supabaseConfigured && email) {
      try {
        const client = supabaseBrowser();
        const { data, error } = await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: name, phone, locale: "bn" },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/account/profile?welcome=1`,
          },
        });
        if (error) throw error;

        // Email confirmation ON → no session yet. Tell the user to verify.
        if (!data.session) {
          setNotice(
            "অ্যাকাউন্ট তৈরি হয়েছে! ইনবক্সে পাঠানো লিঙ্কে ক্লিক করে ইমেইল যাচাই করুন, তারপর লগইন করুন।"
          );
          toast.success(
            t("অ্যাকাউন্ট তৈরি হয়েছে", "Account created"),
            t("ইমেইল যাচাই করুন", "Please verify your email")
          );
          setMode("login");
          return;
        }

        await exchange(data.session.access_token, true);
        toast.success(t("অ্যাকাউন্ট তৈরি হয়েছে", "Account created"));
        router.push("/account/profile?welcome=1");
        router.refresh();
        return;
      } catch (err) {
        const msg = (err as Error).message;
        if (!/already registered|user_already_exists/i.test(msg)) {
          toast.error(t("নিবন্ধন ব্যর্থ", "Sign-up failed"), msg);
          setLoading(false);
          return;
        }
        toast.error(t("এই ইমেইলে আগেই অ্যাকাউন্ট আছে", "Account already exists"), msg);
      }
    }

    // ── fallback: legacy register (phone-first, no email verification)
    try {
      await post("/api/auth/register", {
        name,
        email: email || undefined,
        phone,
        password,
      });
      toast.success(t("অ্যাকাউন্ট তৈরি হয়েছে", "Account created"));
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error(t("নিবন্ধন ব্যর্থ", "Sign-up failed"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const data = await post("/api/auth/otp/request", { phone });
      setOtpSent(true);
      if (data.devCode) {
        setDevCode(data.devCode);
        toast.info(
          t("ডেভ মোড: কোডটি নিচে দেখানো হয়েছে", "Dev mode: your code is shown below"),
          data.devCode
        );
      } else {
        toast.success(t("ওটিপি পাঠানো হয়েছে", "OTP sent"), t("৫ মিনিটের মধ্যে ব্যবহার করুন", "Valid for 5 minutes"));
      }
    } catch (err) {
      toast.error(t("ওটিপি পাঠানো যায়নি", "Could not send OTP"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      await post("/api/auth/otp/verify", { phone, code: otp, name });
      toast.success(t("লগইন সফল", "Signed in"));
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error(t("যাচাই ব্যর্থ", "Verification failed"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="card p-6 sm:p-7">
        <div className="text-center">
          <h1 className="text-xl font-bold sm:text-2xl">
            {mode === "register" ? t("নতুন অ্যাকাউন্ট", "Create account") : t("স্বাগতম!", "Welcome back")}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-sand-100/50">
            {mode === "otp"
              ? t("মোবাইল নম্বর দিয়ে দ্রুত লগইন করুন", "Sign in quickly with your phone number")
              : t("অর্ডার ট্র্যাক করুন ও সাবস্ক্রিপশন ম্যানেজ করুন", "Track orders and manage subscriptions")}
          </p>
        </div>

        {/* A failed Google round-trip lands here with ?error=<reason>. */}
        {params.get("error") ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-red-200"
          >
            <span aria-hidden>⚠</span>
            <span>
              {(() => {
                const entry = CALLBACK_ERRORS[params.get("error") ?? ""];
                return entry ? t(entry.bn, entry.en) : t("লগইন সম্পন্ন হয়নি।", "Sign-in did not complete.");
              })()}
            </span>
          </div>
        ) : null}

        {/* mode tabs */}
        <div className="mt-5 flex gap-1 rounded-full border border-white/[0.07] bg-ink-850/70 p-1">
          {[
            { key: "login", label: t("লগইন", "Login") },
            { key: "register", label: t("সাইন আপ", "Sign up") },
            { key: "otp", label: t("OTP", "OTP") },
            { key: "forgot", label: t("পাসওয়ার্ড ভুলে গেছি", "Forgot") },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key as Mode)}
              className={`flex-1 rounded-full px-3 py-2 text-[12.5px] font-semibold transition ${
                mode === m.key ? "bg-leaf-600 text-white" : "text-sand-100/60 hover:text-sand-100"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* ── login */}
        {mode === "login" ? (
          <>
            <div className="mt-5">
              <GoogleButton next={redirectTo} />
            </div>
            <OrDivider />
            {notice ? (
              <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-100">
                {notice}
                {identifier.includes("@") ? (
                  <button
                    type="button"
                    onClick={resendVerification}
                    className="mt-1.5 block font-semibold text-amber-200 underline underline-offset-2"
                  >
                    যাচাই লিঙ্ক আবার পাঠান
                  </button>
                ) : null}
              </div>
            ) : null}
          <form onSubmit={handleLogin} className="mt-0 space-y-3.5">
            <label className="block">
              <span className="label">{t("ইমেইল বা মোবাইল", "Email or mobile")}</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="input !pl-10"
                  placeholder={t("you@example.com বা 01712345678", "you@example.com or 01712345678")}
                  autoComplete="username"
                />
              </div>
            </label>
            <label className="block">
              <span className="label">{t("পাসওয়ার্ড", "Password")}</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input !pl-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
              {t("লগইন করুন", "Sign in")}
            </button>

            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="w-full text-center text-[12px] text-sand-100/50 hover:text-leaf-200"
            >
              {t("পাসওয়ার্ড ভুলে গেছেন?", "Forgot your password?")}
            </button>
          </form>
          </>
        ) : null}

        {/* ── register */}
        {mode === "register" ? (
          <>
            <div className="mt-5">
              <GoogleButton next={redirectTo} label={t("Google দিয়ে সাইন আপ", "Sign up with Google")} />
            </div>
            <OrDivider />
          {notice ? (
            <div className="mb-3 rounded-xl border border-leaf-500/30 bg-leaf-600/10 px-3 py-2.5 text-[12px] leading-relaxed text-leaf-100">
              {notice}
            </div>
          ) : null}
          <form onSubmit={handleRegister} className="mt-0 space-y-3.5">
            <label className="block">
              <span className="label">{t("পুরো নাম", "Full name")}</span>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input !pl-10"
                  placeholder={t("রফিকুল ইসলাম", "Rafiqul Islam")}
                  autoComplete="name"
                />
              </div>
              {errors.name ? <p className="mt-1 text-[11px] text-red-300">{errors.name}</p> : null}
            </label>
            <label className="block">
              <span className="label">{t("মোবাইল নম্বর", "Mobile number")}</span>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input !pl-10"
                  placeholder="01712345678"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              {errors.phone ? <p className="mt-1 text-[11px] text-red-300">{errors.phone}</p> : null}
            </label>
            <label className="block">
              <span className="label">{t("ইমেইল (ঐচ্ছিক)", "Email (optional)")}</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input !pl-10"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              {errors.email ? <p className="mt-1 text-[11px] text-red-300">{errors.email}</p> : null}
            </label>
            <label className="block">
              <span className="label">{t("পাসওয়ার্ড", "Password")}</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input !pl-10"
                  placeholder={t("কমপক্ষে ৮ অক্ষর", "At least 8 characters")}
                  autoComplete="new-password"
                />
              </div>
              {errors.password ? <p className="mt-1 text-[11px] text-red-300">{errors.password}</p> : null}
            </label>

            <p className="text-[11px] leading-relaxed text-sand-100/40">
              {t(
                "নিবন্ধনের পর ইমেইলে একটি যাচাই লিঙ্ক পাঠানো হবে। যাচাই না করলে লগইন করা যাবে না।",
                "We will email you a verification link. You must verify before signing in."
              )}
            </p>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
              {t("অ্যাকাউন্ট তৈরি করুন", "Create account")}
            </button>
          </form>
          </>
        ) : null}

        {/* ── forgot password */}
        {mode === "forgot" ? (
          <div className="mt-5">
            {resetSent ? (
              <div className="space-y-3 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-leaf-600/15 text-leaf-200">
                  <Mail className="h-5 w-5" />
                </span>
                <p className="text-[13px] font-semibold">ইমেইল পাঠানো হয়েছে</p>
                <p className="text-[12px] leading-relaxed text-sand-100/55">
                  <strong className="text-sand-100">{identifier}</strong> এ একটি পাসওয়ার্ড রিসেট
                  লিঙ্ক পাঠানো হয়েছে। লিঙ্কে ক্লিক করে নতুন পাসওয়ার্ড দিন।
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResetSent(false);
                    setMode("login");
                  }}
                  className="btn-ghost w-full"
                >
                  লগইনে ফিরে যান
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3.5">
                <p className="text-[12px] leading-relaxed text-sand-100/55">
                  আপনার অ্যাকাউন্টের ইমেইল দিন — রিসেট লিঙ্ক পাঠানো হবে।
                </p>
                <label className="block">
                  <span className="label">{t("ইমেইল", "Email")}</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                    <input
                      required
                      type="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="input !pl-10"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                </label>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? <Spinner /> : <Mail className="h-4 w-4" />}
                  {t("রিসেট লিঙ্ক পাঠান", "Send reset link")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full text-center text-[12px] text-sand-100/50 hover:text-sand-100"
                >
                  লগইনে ফিরে যান
                </button>
              </form>
            )}
          </div>
        ) : null}

        {/* ── OTP */}
        {mode === "otp" ? (
          <div className="mt-5">
            {!otpSent ? (
              <form onSubmit={requestOtp} className="space-y-3.5">
                <label className="block">
                  <span className="label">{t("মোবাইল নম্বর", "Mobile number")}</span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input !pl-10"
                      placeholder="01712345678"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                  {errors.phone ? <p className="mt-1 text-[11px] text-red-300">{errors.phone}</p> : null}
                </label>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? <Spinner /> : <Phone className="h-4 w-4" />}
                  {t("কোড পাঠান", "Send code")}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-3.5">
                <p className="rounded-xl bg-leaf-600/10 px-3 py-2 text-[12px] text-leaf-200">
                  {t("৬ ডিজিটের কোড পাঠানো হয়েছে", "A 6-digit code was sent to")} <strong>{phone}</strong>
                </p>

                {devCode ? (
                  <p className="rounded-xl border border-dashed border-amber-400/40 bg-amber-500/10 px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.3em] text-amber-200">
                    {devCode}
                  </p>
                ) : null}

                <label className="block">
                  <span className="label">{t("কোড", "Code")}</span>
                  <input
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="input text-center font-mono text-lg tracking-[0.5em]"
                    placeholder="••••••"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>

                <label className="block">
                  <span className="label">{t("নাম (নতুন হলে)", "Name (if new)")}</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder={t("আপনার নাম", "Your name")}
                  />
                </label>

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
                  {t("যাচাই করে লগইন", "Verify & sign in")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setDevCode(null);
                  }}
                  className="w-full text-center text-[12px] text-sand-100/50 hover:text-sand-100"
                >
                  {t("নম্বর বদলান", "Change number")}
                </button>
              </form>
            )}
          </div>
        ) : null}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-sand-100/35">
          {t("লগইন করলে আপনি আমাদের", "By signing in you agree to our")}{" "}
          <Link href="/policies/terms" className="text-leaf-300 hover:underline">{t("শর্তাবলী", "terms")}</Link>{" "}
          {t("মেনে নিচ্ছেন।", "and privacy policy.")}
        </p>
      </div>

      <p className="mt-4 text-center text-[12px] text-sand-100/40">
        {t("লগইন ছাড়াও", "No account needed —")}{" "}
        <Link href="/products" className="text-leaf-300 hover:underline">{t("গেস্ট হিসেবে অর্ডার করুন", "order as guest")}</Link>
      </p>
    </div>
  );
}
