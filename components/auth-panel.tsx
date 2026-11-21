"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { Spinner } from "./ui";

type Mode = "login" | "register" | "otp";

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
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

        {/* mode tabs */}
        <div className="mt-5 flex gap-1 rounded-full border border-white/[0.07] bg-ink-850/70 p-1">
          {[
            { key: "login", label: t("লগইন", "Login") },
            { key: "register", label: t("সাইন আপ", "Sign up") },
            { key: "otp", label: t("OTP", "OTP") },
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
          <form onSubmit={handleLogin} className="mt-5 space-y-3.5">
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
          </form>
        ) : null}

        {/* ── register */}
        {mode === "register" ? (
          <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
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

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
              {t("অ্যাকাউন্ট তৈরি করুন", "Create account")}
            </button>
          </form>
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
