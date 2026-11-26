"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Play, Timer } from "lucide-react";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   TrialStarter
   --------------------------------------------------------------------------
   The trial lives entirely on the server (trial_grants keyed by device
   fingerprint). This component only:
     • asks /api/premium/state what the visitor already has
     • posts /api/premium/trial to start it
     • runs a cosmetic countdown from the server's expires_at
   ========================================================================== */

type State = {
  canWatch: boolean;
  isPremium: boolean;
  reason: "premium" | "trial" | "locked" | "anonymous";
  trial: { active: boolean; expiresAt: string | null; minutes: number } | null;
  trial_minutes: number;
  /** False for a signed-out visitor — a trial now requires an account. */
  signedIn?: boolean;
  expiresAt?: string;
};

export function TrialStarter() {
  const { success, error: errorToast } = useToast();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [left, setLeft] = useState<number>(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/premium/state", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        const data = json.data as State;
        setState(data);
        if (data.trial?.active && data.trial.expiresAt) setExpiresAt(data.trial.expiresAt);
      }
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা", "আবার চেষ্টা করুন");
    } finally {
      setLoading(false);
    }
  }, [errorToast]);

  useEffect(() => {
    load();
  }, [load]);

  // countdown
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/premium/trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // No body: the trial identity is the account plus a server-side
        // device hash. Anything sent here is ignored by design.
        body: JSON.stringify({}),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("ট্রায়াল শুরু করা যায়নি", json?.message);
        await load();
        return;
      }

      setExpiresAt(json.data.expiresAt);
      setState((prev) =>
        prev
          ? {
              ...prev,
              canWatch: true,
              reason: "trial",
              trial: { active: true, expiresAt: json.data.expiresAt, minutes: json.data.minutes },
            }
          : prev
      );
      success("ট্রায়াল শুরু হয়েছে", "এখন লাইভ ক্যামেরা দেখতে পারবেন");
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="card grid place-items-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-mint" />
      </div>
    );
  }

  // already premium
  if (state?.isPremium) {
    return (
      <div className="card border-mint/25 bg-leaf-900/25 p-8 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-mint" />
        <p className="mt-3 text-[15px] font-bold text-neu-ink">আপনার প্রিমিয়াম সক্রিয় আছে</p>
        <p className="mt-1 text-[12.5px] text-sand-100/55">সব লাইভ ক্যামেরা দেখতে পারবেন।</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/live/farms" className="btn-primary btn-sm">
            খামার দেখুন
          </Link>
          <Link href="/account/premium" className="btn-ghost btn-sm">
            আমার সাবস্ক্রিপশন
          </Link>
        </div>
      </div>
    );
  }

  // trial running
  if (expiresAt && left > 0) {
    const mm = String(Math.floor(left / 60)).padStart(2, "0");
    const ss = String(left % 60).padStart(2, "0");
    return (
      <div className="card border-mint/25 bg-leaf-900/25 p-8 text-center">
        <Timer className="mx-auto h-9 w-9 text-mint" />
        <p className="mt-3 text-[15px] font-bold text-neu-ink">ট্রায়াল চলছে</p>
        <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-mint">
          {mm}:{ss}
        </p>
        <p className="mt-1 text-[12px] text-sand-100/50">বাকি সময়</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/live/farms" className="btn-primary btn-sm">
            <Play className="h-3.5 w-3.5" /> লাইভ দেখুন
          </Link>
          <Link href="/live/plans" className="btn-ghost btn-sm">
            প্রিমিয়াম নিন
          </Link>
        </div>
      </div>
    );
  }

  // expired
  const expired = state?.trial && state.trial.expiresAt && !state.trial.active;

  if (expired) {
    return (
      <div className="card border-amber-500/25 bg-amber-500/5 p-8 text-center">
        <p className="text-2xl">⏳</p>
        <p className="mt-3 text-[15px] font-bold text-neu-ink">আপনার ফ্রি ট্রায়াল শেষ হয়েছে</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/55">
          চালিয়ে যেতে প্রিমিয়াম প্ল্যান নিন — মাসে মাত্র ৳১৪৯ থেকে।
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/live/plans" className="btn-primary btn-sm">
            প্ল্যান দেখুন
          </Link>
          <Link href="/login?next=/live/plans" className="btn-ghost btn-sm">
            লগইন করুন
          </Link>
        </div>
      </div>
    );
  }

  /* Signed out: the trial is tied to an account now (it used to be tied to a
     browser fingerprint, which was resettable by changing a client-side hint),
     so ask for the login instead of offering a button that would 401. */
  if (state && state.signedIn === false) {
    return (
      <div className="card p-8 text-center">
        <p className="text-2xl">🎬</p>
        <p className="mt-2 text-[15px] font-bold text-neu-ink">
          {bn(state.trial_minutes)} মিনিট ফ্রি ট্রায়াল
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/55">
          ট্রায়ালটি অ্যাকাউন্টের সাথে যুক্ত — একজন একটি। শুরু করতে লগইন করুন।
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/login?next=/live" className="btn-mint mx-auto">
            <Play className="h-4 w-4" /> লগইন করে ট্রায়াল নিন
          </Link>
          <Link href="/live/plans" className="btn-ghost btn-sm">
            প্ল্যান দেখুন
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-8 text-center">
      <p className="text-2xl">🎬</p>
      <p className="mt-2 text-[15px] font-bold text-neu-ink">
        আপনার {bn(state?.trial_minutes ?? 10)} মিনিট ফ্রি ট্রায়াল এখনো নেওয়া হয়নি
      </p>
      <p className="mt-1 text-[12.5px] text-sand-100/55">নিচের বাটনে চাপ দিন — সাথে সাথেই শুরু হবে।</p>
      <button type="button" onClick={start} disabled={starting} className="btn-mint mx-auto mt-5">
        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {starting ? "শুরু হচ্ছে…" : "ট্রায়াল শুরু করুন"}
      </button>
    </div>
  );
}

function bn(n: number): string {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}
