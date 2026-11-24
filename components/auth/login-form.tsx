"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { createClient, setRememberSession, supabaseConfigured } from "@/lib/supabase/client";
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
  /**
   * A concrete next step offered under the message. `diagnose()` sets one after
   * a rejected password so the visitor is never left with a dead end.
   */
  action?: "google" | "reset" | "signup";
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
    /* The built-in sender allows only a couple of mails an hour; say so instead
       of a vague "try later" that makes the owner think the site is broken. */
    return {
      bn: "ইমেইল পাঠানোর সীমা শেষ (ঘণ্টায় মাত্র ২টি যায়)। কিছুক্ষণ পরে আবার চেষ্টা করুন — জরুরি হলে সরাসরি হটলাইনে কল করুন।",
    };
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

/* ==========================================================================
   FloatField — floating-label input
   --------------------------------------------------------------------------
   The label sits inside the box and rises on focus / when filled. Pure CSS
   (`peer` + `placeholder=" "`), so it works before hydration too.
   ========================================================================== */
type FloatFieldProps = {
  label: string;
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  inputMode?: "email" | "text" | "numeric" | "tel";
  minLength?: number;
  trailing?: React.ReactNode;
  hint?: React.ReactNode;
};

function FloatField({
  label,
  icon,
  type = "text",
  value,
  onChange,
  autoComplete,
  inputMode,
  minLength,
  trailing,
  hint,
}: FloatFieldProps) {
  const id = useId();
  const [capsOn, setCapsOn] = useState(false);
  return (
    <div>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-neu-faint transition group-focus-within:text-neu-accent">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCapsOn(type === "password" && e.getModifierState("CapsLock"))}
          onKeyDown={(e) => setCapsOn(type === "password" && e.getModifierState("CapsLock"))}
          onBlur={() => setCapsOn(false)}
          placeholder=" "
          aria-label={label}
          /* 16px text stops iOS from zooming the page on focus */
          className="peer h-[52px] w-full rounded-2xl border border-neu-line/60 bg-neu-bg pb-1.5 pl-10 pr-12 pt-6 text-[16px] text-neu-ink outline-none transition shadow-neu-inset-sm placeholder:text-transparent focus:border-neu-accent/60 focus:ring-4 focus:ring-neu-accent/10"
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-[14px] text-neu-faint transition-all duration-200 peer-focus:top-[15px] peer-focus:text-[11px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:text-neu-accent-strong peer-[:not(:placeholder-shown)]:top-[15px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-semibold peer-[:not(:placeholder-shown)]:tracking-wide"
        >
          {label}
        </label>
        {trailing ? <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span> : null}
      </div>
      {capsOn ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[#a35c07]" role="status">
          <AlertTriangle className="h-3 w-3" /> Caps Lock চালু আছে
        </p>
      ) : null}
      {hint}
    </div>
  );
}

/** 3-bar password strength: length, letters+digits, symbol/length bonus. */
function strengthOf(password: string) {
  const checks = [
    password.length >= 8,
    /[A-Za-z]/.test(password) && /\d/.test(password),
    password.length >= 12 || /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  return {
    score,
    label: ["খুব দুর্বল", "দুর্বল", "ভালো", "শক্তিশালী"][score],
    tone: ["bg-red-500", "bg-amber-500", "bg-leaf-400", "bg-leaf-500"][score],
  };
}

export function LoginForm({ admin = false }: { admin?: boolean } = {}) {
  const router = useRouter();
  const surface = useRef<HTMLDivElement | null>(null);
  const toast = useToast();
  const params = useSearchParams();

  const next = useMemo(() => safeNextPath(params.get("next"), "/"), [params]);
  const callbackError = params.get("error");
  const callbackReason = params.get("reason");

  const [mode, setMode] = useState<Mode>(() =>
    !admin && params.get("mode") === "signup" ? "signup" : "login"
  );
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [remember, setRemember] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
    const checkCaps = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === "function") {
        setCapsLock(e.getModifierState("CapsLock"));
      }
    };
    window.addEventListener("keydown", checkCaps);
    window.addEventListener("keyup", checkCaps);
    return () => {
      window.removeEventListener("keydown", checkCaps);
      window.removeEventListener("keyup", checkCaps);
    };
  }, []);

  useEffect(() => {
    setError(null);
    setNotice(null);
  }, [mode]);

  const cleanEmail = () => email.trim().toLowerCase();
  const strength = strengthOf(password);

  /* --------------------------------------------------- why did it fail? */
  /**
   * Supabase answers a wrong password, an unknown address and a Google-created
   * account identically. /api/auth/login-help (service key, rate limited) tells
   * them apart so the message can point at the right button.
   */
  async function diagnose(address: string) {
    try {
      const res = await fetch("/api/auth/login-help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      const info = json?.data as
        | { exists: boolean | null; hasPassword: boolean | null; providers: string[]; unconfirmed: boolean | null }
        | undefined;
      if (!info || info.exists === null) return;

      // The visitor may have edited the field while we were asking.
      if (cleanEmail() !== address) return;

      const googleOnly = info.providers.includes("google") && info.hasPassword === false;

      if (info.exists === false) {
        setError({
          bn: "এই ইমেইলে আমাদের কোনো অ্যাকাউন্ট নেই। আগে সাইন আপ করুন — অথবা বানান ঠিক আছে কি না দেখুন।",
          action: "signup",
        });
        return;
      }
      if (info.unconfirmed) {
        setError({
          bn: "অ্যাকাউন্টটি আছে, কিন্তু ইমেইল এখনো যাচাই হয়নি। ইনবক্সের লিংকে ক্লিক করুন, অথবা নিচের বাটনে আবার পাঠান।",
          resend: true,
        });
        return;
      }
      if (googleOnly) {
        setError({
          bn: "এই অ্যাকাউন্টটি Google দিয়ে তৈরি — এতে পাসওয়ার্ড নেই। নিচের Google বাটনে চাপ দিন, অথবা পাসওয়ার্ড ভুলে গেছি দিয়ে একটি পাসওয়ার্ড সেট করুন।",
          action: "google",
        });
        return;
      }
      setError({
        bn: "পাসওয়ার্ড মিলছে না। পাসওয়ার্ড ভুলে গেছে? নিচের বাটনে চাপ দিয়ে নতুন পাসওয়ার্ড সেট করুন।",
        action: "reset",
      });
    } catch {
      /* the original message is already on screen — this is only an upgrade */
    }
  }

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
      setRememberSession(remember);
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail(),
        password,
      });

      if (signInError) {
        const mapped = friendlyError(signInError.message);
        setError(mapped);
        // never log the password; the message alone is enough for support
        console.error("[auth] signInWithPassword:", signInError.message);
        /* "Invalid login credentials" covers three very different situations.
           Ask our own endpoint which one it is, then say something useful. */
        if (/invalid login credentials/i.test(signInError.message)) {
          void diagnose(cleanEmail());
        }
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
    if (!acceptedTerms) return setError({ bn: "অ্যাকাউন্ট খুলতে শর্তাবলী ও গোপনীয়তা নীতিতে সম্মতি দিন।" });
    if (!supabaseConfigured) {
      return setError({ bn: "সার্ভার কনফিগারেশন পাওয়া যাচ্ছে না — অ্যাডমিনকে জানান।" });
    }

    setBusy(true);
    try {
      setRememberSession(remember);
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
      setRememberSession(remember);
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

  const tabs: Mode[] = admin ? ["login", "forgot"] : ["login", "signup", "forgot"];
  const tabIndex = Math.max(0, tabs.indexOf(mode));

  const tabClass = (active: boolean) =>
    `relative z-10 flex-1 whitespace-nowrap rounded-xl px-1.5 py-2.5 text-[11.5px] font-semibold leading-tight transition-colors duration-300 min-h-[44px] sm:px-2 sm:text-[13.5px] ${
      active ? "text-white" : "text-neu-muted hover:text-neu-ink"
    }`;

  const actionButton =
    "mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-red-500/25 px-3 py-1 text-[11.5px] font-semibold text-[#c0392b] transition hover:bg-red-500/10 disabled:opacity-60";

  return (
    <div className="auth-card auth-rise w-full max-w-[484px]" style={{ ["--d" as string]: "120ms" }}>
      {/* mobile brand header (the desktop split panel carries this on ≥lg) */}
      <div className="mb-5 flex items-center gap-2.5 lg:hidden">
        <span className="auth-pulse neu-raised-xs grid h-10 w-10 place-items-center rounded-2xl bg-neu-accent-soft text-neu-accent-strong">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[15px] font-bold leading-tight text-neu-ink">বিশ্বাস এগ্রো</p>
          <p className="text-[11px] text-neu-muted">বিশুদ্ধতার আস্থায়, খামার থেকে আপনার ঘরে</p>
        </div>
      </div>

      <div
        ref={surface}
        onPointerMove={(e) => {
          const el = surface.current;
          if (!el || e.pointerType !== "mouse") return;
          const rect = el.getBoundingClientRect();
          el.style.setProperty("--auth-mx", `${e.clientX - rect.left}px`);
          el.style.setProperty("--auth-my", `${e.clientY - rect.top}px`);
        }}
        className="auth-spot-host auth-inner relative overflow-hidden rounded-[26px] border border-white/85 bg-neu-surface/95 p-4 shadow-neu-lg sm:p-6 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        {admin ? (
          <span className="neu-pill mb-2 gap-1.5 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider !text-neu-accent-strong">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure admin access
          </span>
        ) : null}
        <h2
          className="auth-rise text-[21px] font-bold tracking-tight text-neu-ink sm:text-[23px]"
          style={{ ["--d" as string]: "60ms" }}
        >
          {mode === "signup" ? "নতুন অ্যাকাউন্ট" : mode === "forgot" ? "পাসওয়ার্ড রিসেট" : admin ? "অ্যাডমিন প্যানেল" : "আবার স্বাগতম"}
        </h2>
        <p className="auth-rise mt-1 text-[12.5px] leading-relaxed text-neu-muted" style={{ ["--d" as string]: "90ms" }}>
          {mode === "signup"
            ? "মাত্র ৩টি তথ্য দিয়ে অ্যাকাউন্ট খুলুন — অর্ডার, ঠিকানা আর স্ট্যাটাস এক জায়গায়।"
            : mode === "forgot"
              ? "অ্যাকাউন্টের ইমেইল দিন — রিসেট লিঙ্ক পাঠিয়ে দেব।"
              : admin
                ? "শুধু অনুমোদিত অ্যাডমিন অ্যাকাউন্টে প্রবেশ করুন।"
                : "ইমেইল/পাসওয়ার্ড বা Google — যেভাবে আপনার সুবিধা।"}
        </p>

        {/* tabs */}
        <div
          role="tablist"
          aria-label="লগইন, সাইন আপ বা পাসওয়ার্ড রিসেট"
          className="auth-rise neu-inset-sm relative mt-5 flex gap-1 overflow-hidden rounded-2xl p-1"
          style={{ ["--d" as string]: "120ms" }}
        >
          {/* the pill slides between tabs instead of blinking on/off */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1 left-1 rounded-xl bg-gradient-to-b from-leaf-500 to-leaf-600 shadow-[0_10px_26px_-12px_rgba(31,122,77,1)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              /* p-1 on both sides + gap-1 between tabs, so the pill lands
                 exactly on top of its button for any tab count */
              width: `calc((100% - 0.5rem - ${(tabs.length - 1) * 0.25}rem) / ${tabs.length})`,
              transform: `translateX(calc(${tabIndex} * (100% + 0.25rem)))`,
            }}
          />
          <button type="button" role="tab" aria-selected={mode === "login"} className={tabClass(mode === "login")} onClick={() => setMode("login")}>
            লগইন
          </button>
          {admin ? null : (
            <button type="button" role="tab" aria-selected={mode === "signup"} className={tabClass(mode === "signup")} onClick={() => setMode("signup")}>
              সাইন আপ
            </button>
          )}
          <button type="button" role="tab" aria-selected={mode === "forgot"} className={tabClass(mode === "forgot")} onClick={() => setMode("forgot")}>
            পাসওয়ার্ড ভুলে গেছি
          </button>
        </div>

        {/* error / notice */}
        {error ? (
          <div
            role="alert"
            key={error.bn}
            className="auth-shake mt-4 flex gap-2 rounded-2xl border border-red-500/25 bg-red-500/8 px-3.5 py-3 text-[12.5px] leading-relaxed text-[#c0392b]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c0392b]" aria-hidden />
            <div className="min-w-0 flex-1">
            <p>{error.bn}</p>
            {error.resend ? (
              <button type="button" onClick={resendVerification} disabled={busy} className={actionButton}>
                যাচাই ইমেইল আবার পাঠান
              </button>
            ) : null}

            {error.action === "google" ? (
              <button type="button" onClick={continueWithGoogle} disabled={busy} className={actionButton}>
                Google দিয়ে লগইন
              </button>
            ) : null}

            {error.action === "reset" ? (
              <button type="button" onClick={() => setMode("forgot")} className={actionButton}>
                পাসওয়ার্ড রিসেট করুন
              </button>
            ) : null}

            {error.action === "signup" ? (
              <button type="button" onClick={() => setMode("signup")} className={actionButton}>
                সাইন আপ করুন
              </button>
            ) : null}
            </div>
          </div>
        ) : null}

        {notice ? (
          <div role="status" className="auth-enter mt-4 rounded-2xl border border-neu-accent/25 bg-neu-accent-soft/70 px-3.5 py-3 text-[12.5px] leading-relaxed text-neu-accent-strong">
            <p className="flex items-center gap-1.5 font-semibold">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-leaf-500/25">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                  <path
                    d="M4.5 12.5l5 5 10-11"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="auth-draw"
                  />
                </svg>
              </span>
              {notice.title}
            </p>
            <p className="mt-1 text-neu-accent-strong/80">{notice.body}</p>
          </div>
        ) : null}

        {/* ── Google FIRST, then the email form (both login and signup) */}
        {!admin && mode !== "forgot" ? (
          <>
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={busy}
              className="btn-sheen neu-raised auth-rise mt-5 flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-2xl px-4 text-[14.5px] font-semibold text-neu-ink transition duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
              style={{ ["--d" as string]: "150ms" }}
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

            <div className="auth-rise my-4 flex items-center gap-3" style={{ ["--d" as string]: "200ms" }}>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-neu-line/70" />
              <span className="text-[11px] font-medium tracking-wider text-neu-faint">অথবা ইমেইল দিয়ে</span>
              <span className="h-px flex-1 bg-neu-line/50" />
            </div>
          </>
        ) : null}

        {/* ── LOGIN */}
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="auth-enter space-y-3.5" noValidate>
            <FloatField
              label="ইমেইল"
              icon={<Mail className="h-4 w-4" />}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
            />

            <FloatField
              label="পাসওয়ার্ড"
              icon={<Lock className="h-4 w-4" />}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                  className="grid h-10 w-10 place-items-center rounded-xl text-neu-faint transition hover:bg-white/70 hover:text-neu-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <label className="flex cursor-pointer select-none items-center gap-2 text-[11.5px] text-neu-muted sm:text-[12px]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-neu-line bg-neu-bg accent-neu-accent"
                />
                এই ডিভাইসে লগইন রাখুন
              </label>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="whitespace-nowrap text-[11.5px] font-semibold text-neu-accent-strong hover:underline sm:text-[12px]"
              >
                পাসওয়ার্ড ভুলে গেছেন?
              </button>
            </div>

            <button type="submit" disabled={busy} className="btn-primary btn-sheen min-h-[50px] w-full !text-[15px] transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? "লগইন হচ্ছে…" : "লগইন করুন"}
            </button>
          </form>
        ) : null}

        {/* ── SIGNUP */}
        {mode === "signup" ? (
          <form onSubmit={handleSignup} className="auth-enter space-y-3.5" noValidate>
            <FloatField
              label="পুরো নাম"
              icon={<UserIcon className="h-4 w-4" />}
              autoComplete="name"
              value={fullName}
              onChange={setFullName}
            />

            <FloatField
              label="ইমেইল"
              icon={<Mail className="h-4 w-4" />}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
            />

            <FloatField
              label="পাসওয়ার্ড"
              icon={<Lock className="h-4 w-4" />}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={setPassword}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                  className="grid h-10 w-10 place-items-center rounded-xl text-neu-faint transition hover:bg-white/70 hover:text-neu-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              hint={
                <div className="mt-2">
                  <div className="flex gap-1.5" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 origin-left rounded-full transition-colors duration-500 ${
                          password && strength.score > i ? `${strength.tone} auth-bar` : "bg-neu-sunken"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 flex items-center justify-between text-[11px] text-neu-faint">
                    <span>কমপক্ষে ৮ অক্ষর, অক্ষর + সংখ্যা মিশিয়ে দিন</span>
                    {password ? <span className="font-semibold text-neu-muted">{strength.label}</span> : null}
                  </p>
                </div>
              }
            />

            <label className="flex cursor-pointer select-none items-start gap-2.5 rounded-2xl border border-white/80 bg-white/40 p-3 text-[12px] leading-relaxed text-neu-muted">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-neu-line bg-neu-bg accent-neu-accent"
              />
              <span>
                আমি{" "}
                <Link href="/policies/terms" className="font-semibold text-neu-accent-strong hover:underline">
                  শর্তাবলী
                </Link>{" "}
                ও{" "}
                <Link href="/policies/privacy" className="font-semibold text-neu-accent-strong hover:underline">
                  গোপনীয়তা নীতি
                </Link>{" "}
                পড়েছি এবং সম্মতি দিচ্ছি।
              </span>
            </label>

            <button type="submit" disabled={busy} className="btn-primary btn-sheen min-h-[50px] w-full !text-[15px] transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserIcon className="h-4 w-4" />}
              {busy ? "অ্যাকাউন্ট তৈরি হচ্ছে…" : "অ্যাকাউন্ট তৈরি করুন"}
            </button>
          </form>
        ) : null}

        {/* ── FORGOT */}
        {mode === "forgot" ? (
          resetSentTo ? (
            <div className="mt-5 rounded-2xl border border-neu-accent/25 bg-neu-accent-soft/70 p-4 text-center">
              <span className="neu-raised-xs mx-auto grid h-11 w-11 place-items-center rounded-xl bg-neu-accent-soft text-neu-accent-strong">
                <Mail className="h-5 w-5" />
              </span>
              <p className="mt-2 text-[13px] font-bold text-neu-ink">রিসেট লিঙ্ক পাঠানো হয়েছে</p>
              <p className="mt-1 text-[12px] leading-relaxed text-neu-muted">
                <strong className="text-neu-ink">{resetSentTo}</strong> এ একটি লিঙ্ক পাঠানো হয়েছে। ইনবক্সে (স্প্যাম ফোল্ডারেও)
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
            <form onSubmit={handleForgot} className="auth-enter mt-1 space-y-3.5" noValidate>
              <FloatField
                label="অ্যাকাউন্টের ইমেইল"
                icon={<Mail className="h-4 w-4" />}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
              />
              <button type="submit" disabled={busy} className="btn-primary btn-sheen min-h-[50px] w-full !text-[15px] transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {busy ? "পাঠানো হচ্ছে…" : "রিসেট লিঙ্ক পাঠান"}
              </button>
              <button type="button" onClick={() => setMode("login")} className="w-full text-center text-[12px] text-neu-muted transition hover:text-neu-ink">
                লগইনে ফিরে যান
              </button>
            </form>
          )
        ) : null}

        {admin ? (
          <p className="mt-5 rounded-2xl border border-white/80 bg-white/40 px-3 py-2.5 text-[11px] leading-relaxed text-neu-muted">
            এই পেজে Google লগইন বন্ধ। শুধু ইমেইল+পাসওয়ার্ড, এবং অ্যাকাউন্টের রোল{" "}
            <span className="font-semibold text-neu-ink">admin</span> হতে হবে — নাহলে প্যানেল খুলবে না।
          </p>
        ) : null}

        {capsLock && mode !== "forgot" ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-[#a35c07]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#a35c07]" />
            Caps Lock চালু আছে — পাসওয়ার্ডে বড় হাতের অক্ষর টাইপ হচ্ছে
          </p>
        ) : null}

        <div className="mt-5 flex flex-col items-center gap-2 text-center text-[11px] leading-relaxed text-neu-faint">
          <span className="neu-pill px-2.5 py-0.5 text-[10.5px] font-medium !text-neu-accent-strong">
            <ShieldCheck className="h-3 w-3 text-neu-accent" />
            ২৫৬-বিট SSL এনক্রিপ্টেড নিরাপদ সংযোগ
          </span>
          <p>
            সমস্যা হচ্ছে?{" "}
            <Link href="/contact" className="underline transition hover:text-neu-ink">
              আমাদের জানান
            </Link>{" "}
            — অথবা হটলাইনে কল করুন।
          </p>
        </div>
      </div>
    </div>
  );
}
