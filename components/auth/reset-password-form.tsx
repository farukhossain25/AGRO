"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, ShieldAlert } from "lucide-react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   ResetPasswordForm — /reset-password
   --------------------------------------------------------------------------
   The recovery link is exchanged by /auth/callback, so by the time this page
   renders the browser already holds a temporary Supabase session. All we do is
   `updateUser({ password })` — Supabase re-hashes and stores it. No server
   route, no password ever leaves the browser except to Supabase over TLS.
   ========================================================================== */

export function ResetPasswordForm() {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setChecking(false);
      return;
    }
    let alive = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!alive) return;
        setHasSession(Boolean(data.user));
        setChecking(false);
      })
      .catch(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (password.length < 8) return setError("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।");
    if (password !== confirm) return setError("দুটি পাসওয়ার্ড এক নয় — আবার লিখুন।");

    setBusy(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) {
        setError(
          /expired|invalid/i.test(updateError.message)
            ? "লিঙ্কের মেয়াদ শেষ। আবার “পাসওয়ার্ড ভুলে গেছি” থেকে নতুন লিঙ্ক নিন।"
            : `পাসওয়ার্ড বদলানো যায়নি: ${updateError.message}`
        );
        return;
      }
      setDone(true);
      toast.success("পাসওয়ার্ড বদলানো হয়েছে", "নতুন পাসওয়ার্ড দিয়ে লগইন করুন");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="grid h-52 place-items-center text-sand-100/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!hasSession && !done) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
        <ShieldAlert className="mx-auto h-6 w-6 text-amber-300" />
        <p className="mt-2 text-[14px] font-bold text-white">লিঙ্কটি আর কাজ করছে না</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/60">
          পাসওয়ার্ড রিসেট লিঙ্ক একবারই ব্যবহার করা যায় এবং সময়সীমা থাকে। নতুন লিঙ্ক নিতে নিচের বাটনে ক্লিক করুন।
        </p>
        <Link href="/login?mode=forgot" className="btn-primary mt-4 inline-flex min-h-[44px] items-center">
          নতুন রিসেট লিঙ্ক নিন
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-leaf-500/30 bg-leaf-600/10 p-5 text-center">
        <CheckCircle2 className="mx-auto h-6 w-6 text-leaf-300" />
        <p className="mt-2 text-[14px] font-bold text-white">পাসওয়ার্ড বদলানো হয়েছে</p>
        <p className="mt-1 text-[12.5px] text-sand-100/60">এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।</p>
        <Link href="/login" className="btn-primary mt-4 inline-flex min-h-[44px] items-center">
          লগইনে যান
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3.5" noValidate>
      <label className="block">
        <span className="label">নতুন পাসওয়ার্ড</span>
        <div className="relative mt-1.5">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/35" />
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input !pl-10 !pr-11 !text-[16px]"
            placeholder="কমপক্ষে ৮ অক্ষর"
            aria-label="নতুন পাসওয়ার্ড"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
            className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-sand-100/50 hover:bg-white/[0.06]"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>

      <label className="block">
        <span className="label">আবার একই পাসওয়ার্ড</span>
        <div className="relative mt-1.5">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/35" />
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input !pl-10 !text-[16px]"
            placeholder="••••••••"
            aria-label="পাসওয়ার্ড নিশ্চিত করুন"
          />
        </div>
      </label>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-200">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="btn-primary min-h-[48px] w-full !text-[15px]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {busy ? "সংরক্ষণ হচ্ছে…" : "নতুন পাসওয়ার্ড সংরক্ষণ করুন"}
      </button>
    </form>
  );
}
