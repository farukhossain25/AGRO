"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Leaf,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
} from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase-browser";
import { GoogleButton, OrDivider } from "./google-button";
import { Spinner } from "./ui";

type Mode = "login" | "register" | "otp" | "reset" | "forgot";

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
  // useSearchParams must be inside <Suspense> — login/page.tsx already does.
  // Guard for prerender / test where it can be null or throw.
  let params: ReturnType<typeof useSearchParams> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    params = useSearchParams();
  } catch {
    params = null;
  }
  const safeGet = (k: string): string | null => {
    try {
      return params?.get(k) ?? null;
    } catch {
      return null;
    }
  };
  // useLocale/useToast themselves protected in providers, but never let a
  // missing provider crash the login page — show a fallback instead.
  let t: (bn: string, en?: string) => string = (bn, en) => bn;
  let toast: ReturnType<typeof useToast> = { success: () => {}, error: () => {}, info: () => {} } as unknown as ReturnType<typeof useToast>;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    t = useLocale().t;
  } catch {}
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    toast = useToast();
  } catch {}

  const initialMode: Mode = (() => {
    try {
      const m = safeGet("mode");
      if (m === "register" || m === "otp" || m === "forgot" || m === "reset") return m;
      return "login";
    } catch {
      return "login";
    }
  })();
  const [mode, setMode] = useState<Mode>(initialMode);
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
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo = (() => {
    const n = safeGet("next");
    // only allow internal paths to prevent open-redirect
    if (n && n.startsWith("/") && !n.startsWith("//")) return n;
    return "/account";
  })();

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
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (json.errors) setErrors(json.errors);
      throw new Error(json.message ?? json.error ?? "সমস্যা হয়েছে");
    }
    return json.data;
  }

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
    if (loading) return;
    setLoading(true);
    setErrors({});
    setNotice(null);

    const looksLikeEmail = identifier.includes("@");

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
        if (/confirm/i.test(msg) || /email not confirmed/i.test(msg)) {
          setNotice(msg);
          toast.info(t("ইমেইল যাচাই বাকি", "Email not verified"), msg);
          setLoading(false);
          return;
        }
        if (!/invalid login credentials|invalid_credentials|Invalid login credentials/i.test(msg)) {
          // For non-credential errors, show and stop
          if (!/Invalid login credentials/i.test(msg)) {
            toast.error(t("লগইন ব্যর্থ", "Sign-in failed"), msg);
            setLoading(false);
            return;
          }
        }
        // fallback to legacy for invalid credentials
      }
    }

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
    if (loading) return;
    setLoading(true);
    setErrors({});
    try {
      if (!supabaseConfigured) throw new Error("Supabase Auth কনফিগার করা নেই");
      if (!identifier.includes("@")) {
        throw new Error("পাসওয়ার্ড রিসেটের জন্য ইমেইল দিন");
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabaseBrowser().auth.resetPasswordForEmail(
        identifier.trim().toLowerCase(),
        { redirectTo: `${origin}/auth/callback?next=/account/security&type=recovery` }
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
    if (loading) return;
    setLoading(true);
    setErrors({});
    setNotice(null);

    if (supabaseConfigured && email) {
      try {
        const client = supabaseBrowser();
        const { data, error } = await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: name, phone, locale: "bn" },
            emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=/account/profile?welcome=1`,
          },
        });
        if (error) throw error;

        if (!data.session) {
          setNotice(
            "অ্যাকাউন্ট তৈরি হয়েছে! ইনবক্সে পাঠানো লিঙ্কে ক্লিক করে ইমেইল যাচাই করুন, তারপর লগইন করুন।"
          );
          toast.success(
            t("অ্যাকাউন্ট তৈরি হয়েছে", "Account created"),
            t("ইমেইল যাচাই করুন", "Please verify your email")
          );
          setMode("login");
          setLoading(false);
          return;
        }

        await exchange(data.session.access_token, true);
        toast.success(t("অ্যাকাউন্ট তৈরি হয়েছে", "Account created"));
        router.push("/account/profile?welcome=1");
        router.refresh();
        return;
      } catch (err) {
        const msg = (err as Error).message;
        if (!/already registered|user_already_exists|already exists/i.test(msg)) {
          toast.error(t("নিবন্ধন ব্যর্থ", "Sign-up failed"), msg);
          setLoading(false);
          return;
        }
        toast.error(t("এই ইমেইলে আগেই অ্যাকাউন্ট আছে", "Account already exists"), msg);
        setLoading(false);
        return;
      }
    }

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
    if (loading) return;
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
    if (loading) return;
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

  const features = [
    { icon: Truck, bn: "ঢাকা সহ সারা দেশে হোম ডেলিভারি", en: "Home delivery across Bangladesh" },
    { icon: Leaf, bn: "খামার থেকে ১০০% তাজা ও অর্গানিক", en: "100% fresh & organic from farms" },
    { icon: ShieldCheck, bn: "ক্যাশ অন ডেলিভারি ও নিরাপদ পেমেন্ট", en: "Cash on delivery & secure payment" },
  ];

  return (
    <div className="w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_32px_80px_rgba(0,0,0,0.35)] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Left — brand / trust */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-leaf-800 via-leaf-700 to-emerald-900 p-8 text-white lg:flex lg:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wider backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            {t("খামার থেকে আপনার ঘরে", "From farm to your home")}
          </div>
          <h2 className="mt-5 text-[28px] font-black leading-tight tracking-tight">
            {t("বিশুদ্ধতার আস্থায়", "Trust in purity")}
            <br />
            <span className="text-leaf-100">{t("বিশ্বাস এগ্রো", "Biswas Agro")}</span>
          </h2>
          <p className="mt-3 max-w-[36ch] text-[13px] leading-relaxed text-white/75">
            {t(
              "তাজা শাকসবজি, ফলমূল, দেশি ডিম ও অর্গানিক পণ্য — সরাসরি কৃষকের খামার থেকে আপনার দোরগোড়ায়।",
              "Fresh vegetables, fruits, eggs & organic staples — straight from the farmer to your doorstep."
            )}
          </p>

          <div className="mt-8 space-y-3.5">
            {features.map((f) => (
              <div key={f.bn} className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-leaf-700">
                  <f.icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-[13px] font-medium">{t(f.bn, f.en)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-8">
          <div className="flex items-center gap-3 rounded-2xl bg-black/15 p-3 backdrop-blur">
            <div className="flex -space-x-2">
              <img src="https://i.pravatar.cc/100?img=12" alt="" className="h-8 w-8 rounded-full border-2 border-white/20 object-cover" />
              <img src="https://i.pravatar.cc/100?img=32" alt="" className="h-8 w-8 rounded-full border-2 border-white/20 object-cover" />
              <img src="https://i.pravatar.cc/100?img=52" alt="" className="h-8 w-8 rounded-full border-2 border-white/20 object-cover" />
            </div>
            <div className="text-[11px] leading-tight">
              <p className="font-semibold text-white">10,000+ {t("পরিবার", "families")}</p>
              <p className="text-white/70">{t("আমাদের উপর আস্থা রাখছেন", "trust Biswas Agro")}</p>
            </div>
            <div className="ml-auto flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-leaf-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> 4.9/5
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-white/50">
            {t("লগইন করলে আপনি শর্তাবলী ও প্রাইভেসি পলিসিতে সম্মত হচ্ছেন।", "By continuing you agree to our Terms & Privacy Policy.")}
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="bg-[#0f1310] px-6 py-7 text-sand-50 sm:px-8 sm:py-8 lg:bg-white lg:text-ink-900">
        {/* mobile brand */}
        <div className="mb-6 flex items-center gap-3 lg:hidden">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-600 text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] font-black leading-none text-white lg:text-ink-900">বিশ্বাস এগ্রো</p>
            <p className="text-[11px] text-sand-100/60 lg:text-ink-500">biswasagro.com</p>
          </div>
        </div>

        <div className="text-left">
          <h1 className="text-[22px] font-black tracking-tight text-white lg:text-ink-900">
            {mode === "register"
              ? t("নতুন অ্যাকাউন্ট তৈরি করুন", "Create your account")
              : mode === "forgot"
                ? t("পাসওয়ার্ড রিসেট", "Reset password")
                : mode === "otp"
                  ? t("OTP দিয়ে লগইন", "Sign in with OTP")
                  : t("আবার স্বাগতম!", "Welcome back")}
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-sand-100/55 lg:text-ink-500">
            {mode === "register"
              ? t("৩০ সেকেন্ডে অ্যাকাউন্ট খুলুন — অর্ডার ও সাবস্ক্রিপশন সহজে ম্যানেজ করুন", "Create in 30 seconds — manage orders & subscriptions easily")
              : mode === "otp"
                ? t("মোবাইল নম্বর দিয়ে দ্রুত লগইন করুন", "Sign in quickly with your phone number")
                : t("অর্ডার ট্র্যাক করুন ও সাবস্ক্রিপশন ম্যানেজ করুন", "Track orders and manage subscriptions")}
          </p>
        </div>

        {safeGet("error") ? (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-red-200 lg:border-red-200 lg:bg-red-50 lg:text-red-700"
          >
            <span aria-hidden>⚠</span>
            <span>
              {(() => {
                const key = safeGet("error") ?? "";
                const entry = CALLBACK_ERRORS[key];
                return entry ? t(entry.bn, entry.en) : t("লগইন সম্পন্ন হয়নি।", "Sign-in did not complete.");
              })()}
            </span>
          </div>
        ) : null}

        {/* Tabs — pill */}
        <div className="mt-6 grid grid-cols-4 gap-1 rounded-full bg-ink-850 p-1 text-white lg:bg-zinc-100 lg:text-ink-700">
          {[
            { key: "login", label: t("লগইন", "Login") },
            { key: "register", label: t("সাইন আপ", "Sign up") },
            { key: "otp", label: "OTP" },
            { key: "forgot", label: t("ভুলে গেছি", "Forgot") },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key as Mode)}
              className={`rounded-full px-3 py-2 text-[12.5px] font-bold transition ${
                mode === m.key
                  ? "bg-leaf-600 text-white shadow"
                  : "text-sand-100/60 hover:text-white lg:text-ink-500 lg:hover:text-ink-900"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Login */}
        {mode === "login" ? (
          <div className="mt-6">
            <GoogleButton next={redirectTo} />
            <OrDivider />
            {notice ? (
              <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900 lg:bg-amber-50">
                {notice}
                {identifier.includes("@") ? (
                  <button
                    type="button"
                    onClick={resendVerification}
                    className="mt-1.5 block font-semibold text-amber-700 underline underline-offset-2"
                  >
                    যাচাই লিঙ্ক আবার পাঠান
                  </button>
                ) : null}
              </div>
            ) : null}
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <span className="label text-sand-100/70 lg:text-ink-600">{t("ইমেইল বা মোবাইল", "Email or mobile")}</span>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30 lg:text-ink-400" />
                  <input
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="input !pl-10 lg:!border-zinc-200 lg:!bg-white lg:text-ink-900 lg:placeholder:text-zinc-400 lg:focus:!border-leaf-500"
                    placeholder={t("you@example.com বা 01712345678", "you@example.com or 01712345678")}
                    autoComplete="username"
                  />
                </div>
              </label>
              <label className="block">
                <span className="label text-sand-100/70 lg:text-ink-600">{t("পাসওয়ার্ড", "Password")}</span>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30 lg:text-ink-400" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input !pl-10 !pr-10 lg:!border-zinc-200 lg:!bg-white lg:text-ink-900 lg:placeholder:text-zinc-400 lg:focus:!border-leaf-500"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[11px] font-semibold text-sand-100/60 hover:text-white lg:text-zinc-500 lg:hover:text-ink-900"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <button type="submit" disabled={loading} className="btn-primary w-full !py-3 text-[14px] font-bold shadow-[0_10px_24px_rgba(16,122,63,0.35)]">
                {loading ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
                {t("লগইন করুন", "Sign in")}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-[12px] font-medium text-sand-100/60 hover:text-leaf-200 lg:text-zinc-500 lg:hover:text-leaf-600"
                >
                  {t("পাসওয়ার্ড ভুলে গেছেন?", "Forgot password?")}
                </button>
                <span className="text-[12px] text-sand-100/40 lg:text-zinc-400">
                  {t("অ্যাকাউন্ট নেই?", "No account?")}{" "}
                  <button type="button" onClick={() => setMode("register")} className="font-bold text-leaf-300 hover:underline lg:text-leaf-600">
                    {t("সাইন আপ", "Sign up")}
                  </button>
                </span>
              </div>
            </form>
          </div>
        ) : null}

        {/* Register */}
        {mode === "register" ? (
          <div className="mt-6">
            <GoogleButton next={redirectTo} label={t("Google দিয়ে সাইন আপ", "Sign up with Google")} />
            <OrDivider />
            {notice ? (
              <div className="mb-3 rounded-xl border border-leaf-500/30 bg-leaf-600/10 px-3 py-2.5 text-[12px] leading-relaxed text-leaf-100 lg:bg-emerald-50 lg:text-emerald-900">
                {notice}
              </div>
            ) : null}
            <form onSubmit={handleRegister} className="space-y-4">
              <label className="block">
                <span className="label text-sand-100/70 lg:text-ink-600">{t("পুরো নাম", "Full name")}</span>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30 lg:text-ink-400" />
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input !pl-10 lg:!border-zinc-200 lg:!bg-white"
                    placeholder={t("রফিকুল ইসলাম", "Rafiqul Islam")}
                    autoComplete="name"
                  />
                </div>
                {errors.name ? <p className="mt-1 text-[11px] text-red-300 lg:text-red-600">{errors.name}</p> : null}
              </label>
              <label className="block">
                <span className="label text-sand-100/70 lg:text-ink-600">{t("মোবাইল নম্বর", "Mobile number")}</span>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30 lg:text-ink-400" />
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input !pl-10 lg:!border-zinc-200 lg:!bg-white"
                    placeholder="01712345678"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
                {errors.phone ? <p className="mt-1 text-[11px] text-red-300 lg:text-red-600">{errors.phone}</p> : null}
              </label>
              <label className="block">
                <span className="label text-sand-100/70 lg:text-ink-600">{t("ইমেইল (ঐচ্ছিক)", "Email (optional)")}</span>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30 lg:text-ink-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input !pl-10 lg:!border-zinc-200 lg:!bg-white"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                {errors.email ? <p className="mt-1 text-[11px] text-red-300 lg:text-red-600">{errors.email}</p> : null}
              </label>
              <label className="block">
                <span className="label text-sand-100/70 lg:text-ink-600">{t("পাসওয়ার্ড", "Password")}</span>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30 lg:text-ink-400" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input !pl-10 !pr-10 lg:!border-zinc-200 lg:!bg-white"
                    placeholder={t("কমপক্ষে ৮ অক্ষর", "At least 8 characters")}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[11px] font-semibold text-sand-100/60 lg:text-zinc-500"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password ? <p className="mt-1 text-[11px] text-red-300 lg:text-red-600">{errors.password}</p> : null}
              </label>

              <p className="rounded-xl bg-sand-100/5 px-3 py-2 text-[11px] leading-relaxed text-sand-100/60 lg:bg-zinc-50 lg:text-zinc-600">
                {t(
                  "নিবন্ধনের পর ইমেইলে যাচাই লিঙ্ক পাঠানো হবে (যদি ইমেইল দেন)। যাচাই ছাড়া Google/ইমেইল লগইন কাজ করবে না।",
                  "If you add an email, we’ll send a verification link. Verify before signing in with Google/email."
                )}
              </p>

              <button type="submit" disabled={loading} className="btn-primary w-full !py-3 text-[14px] font-bold shadow-[0_10px_24px_rgba(16,122,63,0.35)]">
                {loading ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
                {t("অ্যাকাউন্ট তৈরি করুন", "Create account")}
              </button>
              <p className="text-center text-[12px] text-sand-100/40 lg:text-zinc-500">
                {t("অ্যাকাউন্ট আছে?", "Already have an account?")}{" "}
                <button type="button" onClick={() => setMode("login")} className="font-bold text-leaf-300 hover:underline lg:text-leaf-600">
                  {t("লগইন", "Sign in")}
                </button>
              </p>
            </form>
          </div>
        ) : null}

        {/* Forgot */}
        {mode === "forgot" ? (
          <div className="mt-6">
            {resetSent ? (
              <div className="space-y-3 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-leaf-600/15 text-leaf-600">
                  <Mail className="h-5 w-5" />
                </span>
                <p className="text-[13px] font-bold text-white lg:text-ink-900">ইমেইল পাঠানো হয়েছে</p>
                <p className="text-[12px] leading-relaxed text-sand-100/55 lg:text-zinc-600">
                  <strong className="text-white lg:text-ink-900">{identifier}</strong> এ একটি পাসওয়ার্ড রিসেট লিঙ্ক
                  পাঠানো হয়েছে। লিঙ্কে ক্লিক করে নতুন পাসওয়ার্ড দিন।
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResetSent(false);
                    setMode("login");
                  }}
                  className="btn-ghost w-full lg:border lg:border-zinc-200 lg:bg-zinc-50"
                >
                  লগইনে ফিরে যান
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-[12px] leading-relaxed text-sand-100/55 lg:text-zinc-600">
                  আপনার অ্যাকাউন্টের ইমেইল দিন — রিসেট লিঙ্ক পাঠানো হবে।
                </p>
                <label className="block">
                  <span className="label text-sand-100/70 lg:text-ink-600">{t("ইমেইল", "Email")}</span>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30 lg:text-ink-400" />
                    <input
                      required
                      type="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="input !pl-10 lg:!border-zinc-200 lg:!bg-white"
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
                  className="w-full text-center text-[12px] text-sand-100/50 hover:text-white lg:text-zinc-500"
                >
                  লগইনে ফিরে যান
                </button>
              </form>
            )}
          </div>
        ) : null}

        {/* OTP */}
        {mode === "otp" ? (
          <div className="mt-6">
            {!otpSent ? (
              <form onSubmit={requestOtp} className="space-y-4">
                <label className="block">
                  <span className="label text-sand-100/70 lg:text-ink-600">{t("মোবাইল নম্বর", "Mobile number")}</span>
                  <div className="relative mt-1.5">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30 lg:text-ink-400" />
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input !pl-10 lg:!border-zinc-200 lg:!bg-white"
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
              <form onSubmit={verifyOtp} className="space-y-4">
                <p className="rounded-xl bg-leaf-600/10 px-3 py-2 text-[12px] text-leaf-200 lg:bg-emerald-50 lg:text-emerald-800">
                  {t("৬ ডিজিটের কোড পাঠানো হয়েছে", "A 6-digit code was sent to")} <strong>{phone}</strong>
                </p>
                {devCode ? (
                  <p className="rounded-xl border border-dashed border-amber-400/40 bg-amber-500/10 px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.3em] text-amber-200 lg:bg-amber-50 lg:text-amber-800">
                    {devCode}
                  </p>
                ) : null}
                <label className="block">
                  <span className="label text-sand-100/70 lg:text-ink-600">{t("কোড", "Code")}</span>
                  <input
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="input text-center font-mono text-lg tracking-[0.5em] lg:!border-zinc-200 lg:!bg-white"
                    placeholder="••••••"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>
                <label className="block">
                  <span className="label text-sand-100/70 lg:text-ink-600">{t("নাম (নতুন হলে)", "Name (if new)")}</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input lg:!border-zinc-200 lg:!bg-white"
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
                  className="w-full text-center text-[12px] text-sand-100/50 hover:text-white lg:text-zinc-500"
                >
                  {t("নম্বর বদলান", "Change number")}
                </button>
              </form>
            )}
          </div>
        ) : null}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-sand-100/35 lg:text-zinc-400">
          {t("লগইন করলে আপনি আমাদের", "By signing in you agree to our")}{" "}
          <Link href="/policies/terms" className="font-semibold text-leaf-300 hover:underline lg:text-leaf-600">
            {t("শর্তাবলী", "terms")}
          </Link>{" "}
          {t("মেনে নিচ্ছেন।", "and privacy policy.")}
        </p>
      </div>
    </div>
  );
}
