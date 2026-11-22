"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Leaf,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Truck,
  User as UserIcon,
} from "lucide-react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/session";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   LoginForm — লগইন / সাইন আপ / পাসওয়ার্ড ভুলে গেছি
   --------------------------------------------------------------------------
   Pure Supabase Auth (@supabase/ssr). No custom JWT, no exchange route, no
   token in localStorage.

     • signInWithPassword  → cookies are set by createBrowserClient
     • signUp              → full name goes into user_metadata.full_name, and a
                             DB trigger copies it into profiles.full_name
     • signInWithOAuth     → Google, returning through /auth/callback
     • resetPasswordForEmail → email link returns through /auth/callback to
                               /reset-password

   Every failure is mapped to a real Bangla sentence — never a bare "failed".
   ========================================================================== */

type Mode = "login" | "signup" | "forgot";

type FriendlyError = {
  bn: string;
  /** show the "resend verification" button */
  resend?: boolean;
  /** show the "sign up instead" hint */
  isNewUser?: boolean;
};

/** Supabase's English error strings → Bangla, with an actionable next step. */
function friendlyError(raw: string): FriendlyError {
  const message = raw.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return { bn: "ইমেইল বা পাসওয়ার্ড মিলছে না। আবার চেক করে চেষ্টা করুন।" };
  }
  if (message.includes("email not confirmed")) {
    return {
      bn: "ইমেইল এখনো যাচাই করা হয়নি। ইনবক্সে (স্প্যাম ফোল্ডারেও) পাঠানো লিংকে ক্লিক করুন।",
      resend: true,
    };
  }
  if (message.includes("already registered") || message.includes("already been registered") || message.includes("user already exists")) {
    return {
      bn: "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে। লগইন করুন, অথবা পাসওয়ার্ড রিসেট করুন।",
    };
  }
  if (message.includes("password should be") || message.includes("weak password") || message.includes("password is too short")) {
    return { bn: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।" };
  }
  if (message.includes("rate limit") || message.includes("too many requests") || message.includes("over_email_send_rate_limit")) {
    return { bn: "অনেকবার চেষ্টা করা হয়েছে। ১ মিনিট পর আবার চেষ্টা করুন।" };
  }
  if (message.includes("unable to validate email") || message.includes("invalid email") || message.includes("invalid format")) {
    return { bn: "ইমেইল ঠিকানাটি সঠিক নয় — যেমন you@gmail.com ফরম্যাটে লিখুন।" };
  }
  if (message.includes("signup is disabled") || message.includes("signups not allowed")) {
    return { bn: "নতুন অ্যাকাউন্ট খোলা এখন বন্ধ আছে। আমাদের হটলাইনে যোগাযোগ করুন।" };
  }
  if (message.includes("provider is not enabled") || message.includes("unsupported provider")) {
    return { bn: "Google লগইন এখনো চালু করা হয়নি। ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।" };
  }
  if (message.includes("email link is invalid") || message.includes("token has expired") || message.includes("expired")) {
    return { bn: "লিঙ্কটির মেয়াদ শেষ বা এটি আগেই ব্যবহার হয়েছে। আবার রিসেট লিঙ্ক চান।" };
  }
  if (message.includes("fetch") || message.includes("network") || message.includes("failed to fetch")) {
    return { bn: "ইন্টারনেট সংযোগে সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।" };
  }
  if (message.includes("signup requires a valid password")) {
    return { bn: "একটি পাসওয়ার্ড দিন (কমপক্ষে ৮ অক্ষর)।" };
  }
  if (!raw.trim()) {
    return { bn: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।" };
  }
  return { bn: `সমস্যা হয়েছে: ${raw}` };
}

function Field({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mt-1.5">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-100/35">
        {icon}
      </span>
      {children}
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();

  const next = useMemo(() => safeNextPath(params.get("next"), "/"), [params]);
  const callbackError = params.get("error");
  const callbackReason = params.get("reason");

  const [mode, setMode] = useState<Mode>(() => (params.get("mode") === "signup" ? "signup" : "login"));
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  // A failed /auth/callback lands here. Show a real reason, translated.
  useEffect(() => {
    if (callbackError === "callback_failed") {
      setError({ bn: "লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।" });
      if (callbackReason) console.warn("[auth] callback reason:", callbackReason);
    }
  }, [callbackError, callbackReason]);

  useEffect(() => {
    setError(null);
    setNotice(null);
  }, [mode]);

  const cleanEmail = () => email.trim().toLowerCase();

  /* ------------------------------------------------------------ email login */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    if (!cleanEmail()) return setError({ bn: "আপনার ইমেইল ঠিকানাটি লিখুন।" });
    if (!password) return setError({ bn: "পাসওয়ার্ড লিখুন।" });
    if (!supabaseConfigured) {
      return setError({ bn: "সার্ভার কনফিগারেশন পাওয়া যাচ্ছে না — অ্যাডমিনকে জানান।" });
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail(),
        password,
      });

      if (signInError) {
        setError(friendlyError(signInError.message));
        // never log the password; the message alone is enough for support
        console.error("[auth] signInWithPassword:", signInError.message);
        return;
      }
      if (!data.session) {
        setError({ bn: "লগইন সেশন তৈরি হয়নি। আবার চেষ্টা করুন।" });
        return;
      }

      toast.success("লগইন সফল", "স্বাগতম!");
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  /* ---------------------------------------------------------------- signup */
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    if (fullName.trim().length < 2) return setError({ bn: "আপনার পুরো নাম লিখুন (কমপক্ষে ২ অক্ষর)।" });
    if (!cleanEmail()) return setError({ bn: "একটি সঠিক ইমেইল ঠিকানা দিন।" });
    if (password.length < 8) return setError({ bn: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।" });
    if (!supabaseConfigured) {
      return setError({ bn: "সার্ভার কনফিগারেশন পাওয়া যাচ্ছে না — অ্যাডমিনকে জানান।" });
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail(),
        password,
        options: {
          // Read by the handle_new_user trigger → profiles.full_name
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (signUpError) {
        setError(friendlyError(signUpError.message));
        console.error("[auth] signUp:", signUpError.message);
        return;
      }

      // Email confirmation ON → no session yet. Explain exactly what to do.
      if (!data.session) {
        setNotice({
          title: "অ্যাকাউন্ট তৈরি হয়েছে — ইমেইল যাচাই করুন",
          body: `${cleanEmail()} এ একটি যাচাই লিঙ্ক পাঠানো হয়েছে। লিঙ্কে ক্লিক করলে আপনি লগইন হয়ে যাবেন। (স্প্যাম ফোল্ডারও দেখুন।)`,
        });
        return;
      }

      toast.success("অ্যাকাউন্ট তৈরি হয়েছে", "স্বাগতম!");
      router.replace(next === "/" ? "/account/profile?welcome=1" : next);
      router.refresh();
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------- forgot password */
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    if (!cleanEmail()) return setError({ bn: "অ্যাকাউন্টের ইমেইল ঠিকানাটি লিখুন।" });
    if (!supabaseConfigured) {
      return setError({ bn: "সার্ভার কনফিগারেশন পাওয়া যাচ্ছে না — অ্যাডমিনকে জানান।" });
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail(), {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      });
      if (resetError) {
        setError(friendlyError(resetError.message));
        return;
      }
      setResetSentTo(cleanEmail());
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------------------------- resend verification */
  async function resendVerification() {
    if (!cleanEmail() || busy) return;
    setBusy(true);
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email: cleanEmail(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (resendError) {
        setError(friendlyError(resendError.message));
        return;
      }
      toast.success("যাচাই লিঙ্ক আবার পাঠানো হয়েছে", "ইমেইল চেক করুন");
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------------------- Google */
  async function continueWithGoogle() {
    if (busy) return;
    setError(null);
    if (!supabaseConfigured) {
      setError({ bn: "সার্ভার কনফিগারেশন পাওয়া যাচ্ছে না — অ্যাডমিনকে জানান।" });
      return;
    }
    setBusy(true);
    try {
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) {
        setError(friendlyError(oauthError.message));
        setBusy(false);
      }
      // success ⇒ the browser is already navigating to Google; keep the spinner
    } catch (err) {
      setError(friendlyError((err as Error).message));
      setBusy(false);
    }
  }

  const tabClass = (active: boolean) =>
    `relative flex-1 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition min-h-[44px] ${
      active ? "bg-leaf-600 text-white shadow-[0_8px_20px_-10px_rgba(31,122,77,0.9)]" : "text-sand-100/60 hover:text-sand-100"
    }`;

  return (
    <div className="grid w-full max-w-[1040px] overflow-hidden rounded-[26px] border border-white/[0.07] bg-ink-900/80 shadow-card backdrop-blur-xl lg:grid-cols-[1.05fr_1fr]">
      {/* ── brand panel (desktop only) */}
      <aside className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-gradient-to-br from-leaf-900 via-ink-900 to-[#06110b] p-9 lg:flex">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-leaf-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-emerald-600/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-leaf-500/30 bg-leaf-600/15 px-3 py-1 text-[11px] font-semibold text-leaf-200">
            <Leaf className="h-3.5 w-3.5" /> বিশ্বাস এগ্রো
          </span>
          <h1 className="mt-5 text-[28px] font-bold leading-snug text-white">
            খামার থেকে সরাসরি
            <br />
            আপনার পরিবারের টেবিলে
          </h1>
          <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed text-sand-100/60">
            অ্যাকাউন্ট খুললে অর্ডার হিস্ট্রি, সেভ করা ঠিকানা, প্রিমিয়াম স্ট্যাটাস আর নোটিফিকেশন — সব এক জায়গায়।
          </p>
        </div>
        <ul className="relative space-y-3 text-[12.5px] text-sand-100/70">
          {[
            { Icon: Truck, text: "সারা বাংলাদেশে ডেলিভারি, ২৪–৪৮ ঘণ্টায়" },
            { Icon: ShieldCheck, text: "১০০% খাঁটি — ল্যাব টেস্টেড পণ্য" },
            { Icon: Sparkles, text: "প্রিমিয়াম সদস্যদের জন্য লাইভ খামার ভিউ" },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-leaf-300">
                <Icon className="h-4 w-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>

      {/* ── form panel */}
      <section className="p-5 sm:p-7">
        <h2 className="text-[20px] font-bold text-white sm:text-[22px]">
          {mode === "signup" ? "নতুন অ্যাকাউন্ট" : mode === "forgot" ? "পাসওয়ার্ড রিসেট" : "আবার স্বাগতম"}
        </h2>
        <p className="mt-1 text-[12.5px] text-sand-100/50">
          {mode === "signup"
            ? "মাত্র ৩টি তথ্য দিয়ে অ্যাকাউন্ট খুলুন।"
            : mode === "forgot"
              ? "ইমেইল দিন — রিসেট লিঙ্ক পাঠিয়ে দেব।"
              : "ইমেইল/পাসওয়ার্ড বা Google — যেভাবে সুবিধা।"}
        </p>

        {/* tabs */}
        <div
          role="tablist"
          aria-label="লগইন বা সাইন আপ"
          className="mt-5 flex gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1"
        >
          <button type="button" role="tab" aria-selected={mode === "login"} className={tabClass(mode === "login")} onClick={() => setMode("login")}>
            লগইন
          </button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={tabClass(mode === "signup")} onClick={() => setMode("signup")}>
            সাইন আপ
          </button>
          <button type="button" role="tab" aria-selected={mode === "forgot"} className={tabClass(mode === "forgot")} onClick={() => setMode("forgot")}>
            পাসওয়ার্ড ভুলে গেছি
          </button>
        </div>

        {/* error / notice */}
        {error ? (
          <div role="alert" className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-red-200">
            <p>{error.bn}</p>
            {error.resend ? (
              <button
                type="button"
                onClick={resendVerification}
                disabled={busy}
                className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-red-300/30 px-3 py-1 text-[11.5px] font-semibold text-red-100 hover:bg-red-500/10 disabled:opacity-60"
              >
                যাচাই ইমেইল আবার পাঠান
              </button>
            ) : null}
          </div>
        ) : null}

        {notice ? (
          <div role="status" className="mt-4 rounded-2xl border border-leaf-500/30 bg-leaf-600/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-leaf-100">
            <p className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> {notice.title}
            </p>
            <p className="mt-1 text-leaf-100/80">{notice.body}</p>
          </div>
        ) : null}

        {/* ── LOGIN */}
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="mt-5 space-y-3.5" noValidate>
            <label className="block">
              <span className="label">ইমেইল</span>
              <Field icon={<Mail className="h-4 w-4" />}>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input !pl-10 !text-[16px]"
                  placeholder="you@example.com"
                  aria-label="ইমেইল"
                />
              </Field>
            </label>

            <label className="block">
              <span className="label">পাসওয়ার্ড</span>
              <Field icon={<Lock className="h-4 w-4" />}>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input !pl-10 !pr-11 !text-[16px]"
                  placeholder="••••••••"
                  aria-label="পাসওয়ার্ড"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                  className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-sand-100/50 hover:bg-white/[0.06] hover:text-sand-100"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>
            </label>

            <div className="flex justify-end">
              <button type="button" onClick={() => setMode("forgot")} className="text-[12px] font-semibold text-leaf-300 hover:underline">
                পাসওয়ার্ড ভুলে গেছেন?
              </button>
            </div>

            <button type="submit" disabled={busy} className="btn-primary min-h-[48px] w-full !text-[15px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? "লগইন হচ্ছে…" : "লগইন করুন"}
            </button>
          </form>
        ) : null}

        {/* ── SIGNUP */}
        {mode === "signup" ? (
          <form onSubmit={handleSignup} className="mt-5 space-y-3.5" noValidate>
            <label className="block">
              <span className="label">পুরো নাম</span>
              <Field icon={<UserIcon className="h-4 w-4" />}>
                <input
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input !pl-10 !text-[16px]"
                  placeholder="আপনার নাম"
                  aria-label="পুরো নাম"
                />
              </Field>
            </label>

            <label className="block">
              <span className="label">ইমেইল</span>
              <Field icon={<Mail className="h-4 w-4" />}>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input !pl-10 !text-[16px]"
                  placeholder="you@example.com"
                  aria-label="ইমেইল"
                />
              </Field>
            </label>

            <label className="block">
              <span className="label">পাসওয়ার্ড</span>
              <Field icon={<Lock className="h-4 w-4" />}>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input !pl-10 !pr-11 !text-[16px]"
                  placeholder="কমপক্ষে ৮ অক্ষর"
                  aria-label="পাসওয়ার্ড"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                  className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-sand-100/50 hover:bg-white/[0.06] hover:text-sand-100"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>
              <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-sand-100/40">
                <span className={password.length >= 8 ? "text-leaf-300" : ""}>• কমপক্ষে ৮ অক্ষর</span>
                <span className={/[A-Za-z]/.test(password) && /\d/.test(password) ? "text-leaf-300" : ""}>
                  • অক্ষর + সংখ্যা (ভালো)
                </span>
              </span>
            </label>

            <button type="submit" disabled={busy} className="btn-primary min-h-[48px] w-full !text-[15px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserIcon className="h-4 w-4" />}
              {busy ? "অ্যাকাউন্ট তৈরি হচ্ছে…" : "অ্যাকাউন্ট তৈরি করুন"}
            </button>
          </form>
        ) : null}

        {/* ── FORGOT */}
        {mode === "forgot" ? (
          resetSentTo ? (
            <div className="mt-5 rounded-2xl border border-leaf-500/25 bg-leaf-600/10 p-4 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-leaf-600/20 text-leaf-200">
                <Mail className="h-5 w-5" />
              </span>
              <p className="mt-2 text-[13px] font-bold text-white">রিসেট লিঙ্ক পাঠানো হয়েছে</p>
              <p className="mt-1 text-[12px] leading-relaxed text-sand-100/60">
                <strong className="text-sand-100">{resetSentTo}</strong> এ একটি লিঙ্ক পাঠানো হয়েছে। ইনবক্সে (স্প্যাম ফোল্ডারেও)
                দেখুন, তারপর নতুন পাসওয়ার্ড দিন।
              </p>
              <button
                type="button"
                onClick={() => {
                  setResetSentTo(null);
                  setMode("login");
                }}
                className="btn-ghost mt-3 min-h-[44px] w-full"
              >
                লগইনে ফিরে যান
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="mt-5 space-y-3.5" noValidate>
              <label className="block">
                <span className="label">অ্যাকাউন্টের ইমেইল</span>
                <Field icon={<Mail className="h-4 w-4" />}>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input !pl-10 !text-[16px]"
                    placeholder="you@example.com"
                    aria-label="ইমেইল"
                  />
                </Field>
              </label>
              <button type="submit" disabled={busy} className="btn-primary min-h-[48px] w-full !text-[15px]">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {busy ? "পাঠানো হচ্ছে…" : "রিসেট লিঙ্ক পাঠান"}
              </button>
              <button type="button" onClick={() => setMode("login")} className="w-full text-center text-[12px] text-sand-100/50 hover:text-sand-100">
                লগইনে ফিরে যান
              </button>
            </form>
          )
        ) : null}

        {/* ── Google (login + signup) */}
        {mode !== "forgot" ? (
          <>
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-sand-100/35">অথবা</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={busy}
              className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-4 text-[14px] font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                  <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z" />
                </svg>
              )}
              Google দিয়ে চালিয়ে যান
            </button>
          </>
        ) : null}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-sand-100/35">
          লগইন করলে আপনি আমাদের{" "}
          <Link href="/policies/terms" className="font-semibold text-leaf-300 hover:underline">
            শর্তাবলী
          </Link>{" "}
          ও{" "}
          <Link href="/policies/privacy" className="font-semibold text-leaf-300 hover:underline">
            গোপনীয়তা নীতি
          </Link>{" "}
          মেনে নিচ্ছেন।
        </p>

        <p className="mt-2 text-center text-[11px] text-sand-100/30">
          সমস্যা হচ্ছে?{" "}
          <Link href="/contact" className="underline hover:text-sand-100/60">
            আমাদের জানান
          </Link>
        </p>
      </section>
    </div>
  );
}
