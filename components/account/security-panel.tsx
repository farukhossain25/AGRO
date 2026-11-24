"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   Security panel — password + sessions
   --------------------------------------------------------------------------
   Both actions are plain Supabase Auth calls from the browser:
     • change password: re-authenticate with the current password, then
       `updateUser({ password })`. Re-authenticating is what proves the person
       at the keyboard knows the old password (Supabase itself does not ask).
     • sign out everywhere: `signOut({ scope: "global" })` revokes every refresh
       token, then the server route clears the cookies in this browser.
   ========================================================================== */

export function SecurityPanel({ email }: { email: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"global" | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);

    if (!supabaseConfigured) return setError("সার্ভার কনফিগারেশন পাওয়া যাচ্ছে না।");
    if (next.length < 8) return setError("নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।");
    if (next !== confirm) return setError("নতুন পাসওয়ার্ড দুইবার একই দিতে হবে।");
    if (!email) return setError("অ্যাকাউন্টের ইমেইল পাওয়া যায়নি।");

    setSaving(true);
    try {
      const supabase = createClient();

      // 1. prove the current password is right
      const { error: checkError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: current,
      });
      if (checkError) {
        setError(
          /invalid login credentials/i.test(checkError.message)
            ? "বর্তমান পাসওয়ার্ড মিলছে না।"
            : checkError.message
        );
        return;
      }

      // 2. set the new one
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(
          /should be|weak/i.test(updateError.message)
            ? "পাসওয়ার্ডটি যথেষ্ট শক্তিশালী নয় — কমপক্ষে ৮ অক্ষর, অক্ষর ও সংখ্যা মিশিয়ে দিন।"
            : updateError.message
        );
        return;
      }

      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে", "পরেরবার নতুন পাসওয়ার্ড দিয়ে লগইন করুন");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function signOutEverywhere() {
    if (busy) return;
    setBusy("global");
    try {
      if (supabaseConfigured) {
        await createClient().auth.signOut({ scope: "global" }).catch(() => undefined);
      }
      await signOut();
      toast.success("সব ডিভাইস থেকে লগআউট হয়েছে");
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
          <Mail className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-sand-100/40">লগইন ইমেইল</p>
          <p className="truncate text-[13px] font-semibold">{email ?? "—"}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-leaf-600/15 px-2.5 py-1 text-[10.5px] font-semibold text-leaf-700">
          <ShieldCheck className="h-3 w-3" /> সুরক্ষিত
        </span>
      </div>

      <form onSubmit={changePassword} className="card space-y-4 p-4 sm:p-5">
        <div>
          <h3 className="text-[13.5px] font-semibold">পাসওয়ার্ড পরিবর্তন</h3>
          <p className="mt-0.5 text-[11.5px] text-sand-100/45">
            কমপক্ষে ৮ অক্ষর — অক্ষর ও সংখ্যা মিশিয়ে দিলে আরও নিরাপদ
          </p>
        </div>

        <label className="block">
          <span className="label">বর্তমান পাসওয়ার্ড</span>
          <input
            required
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="input !text-[16px]"
            autoComplete="current-password"
          />
        </label>

        <label className="block">
          <span className="label">নতুন পাসওয়ার্ড</span>
          <input
            required
            type="password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="input !text-[16px]"
            autoComplete="new-password"
          />
        </label>

        <label className="block">
          <span className="label">নতুন পাসওয়ার্ড (আবার)</span>
          <input
            required
            type="password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input !text-[16px]"
            autoComplete="new-password"
          />
        </label>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={saving} className="btn-primary min-h-[44px] w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {saving ? "পরিবর্তন হচ্ছে…" : "পাসওয়ার্ড পরিবর্তন করুন"}
        </button>
      </form>

      <div className="card space-y-3 p-4 sm:p-5">
        <div>
          <h3 className="text-[13.5px] font-semibold">সেশন</h3>
          <p className="mt-0.5 text-[11.5px] text-sand-100/45">
            কোনো ডিভাইস হারিয়ে গেলে বা অন্য কারো প্রবেশ সন্দেহ হলে সব জায়গা থেকে লগআউট করুন।
          </p>
        </div>
        <button
          type="button"
          onClick={signOutEverywhere}
          disabled={busy !== null}
          className="btn-ghost min-h-[44px] w-full !text-red-200 hover:!border-red-400/40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          সব ডিভাইস থেকে লগআউট
        </button>
      </div>

      <Link
        href="/account/profile"
        className="block text-center text-[12px] text-sand-100/45 hover:text-leaf-200"
      >
        প্রোফাইল ও ঠিকানা সেটিংস →
      </Link>
    </div>
  );
}
