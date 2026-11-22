"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";

/* ==========================================================================
   IdleGuard — automatic logout after inactivity (section D)
   --------------------------------------------------------------------------
   Three independent layers, because any one of them alone is defeatable:

     1. The admin cookie is an HS256 JWT with a hard 12-hour exp. No amount of
        client activity extends it — that ceiling is the real limit.
     2. This component signs out after IDLE_MS of no input. It is a courtesy:
        it clears the device for whoever walks up next, and it warns first.
     3. The server re-checks the role on every request, so a stale tab can
        never act on an expired session anyway.

   The countdown is deliberately visible (a modal with a 60 s window) rather
   than silently dropping the session mid-edit.
   ========================================================================== */

const IDLE_MS = 20 * 60_000; // 20 min of silence → warn
const WARN_MS = 60_000; // 60 s to respond
const ACTIVITY_KEY = "ba:last-activity";
const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "visibilitychange"] as const;

export function IdleGuard() {
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARN_MS / 1000);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);

  const signOut = useCallback(async () => {
    try {
      await fetch("/auth/signout", { method: "POST" });
    } catch {
      /* the cookie may already be gone */
    }
    router.push("/login");
    router.refresh();
  }, [router]);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (countdown.current) clearInterval(countdown.current);
    setWarning(false);

    timer.current = setTimeout(() => {
      setWarning(true);
      setSecondsLeft(WARN_MS / 1000);

      countdown.current = setInterval(() => {
        setSecondsLeft((value) => {
          if (value <= 1) {
            if (countdown.current) clearInterval(countdown.current);
            void signOut();
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    }, IDLE_MS);
  }, [signOut]);

  useEffect(() => {
    // A reload must not reset the clock — the timestamp lives in localStorage.
    const stored = Number(localStorage.getItem(ACTIVITY_KEY) ?? 0);
    if (stored && Date.now() - stored > IDLE_MS) {
      void signOut();
      return;
    }

    const onActivity = () => {
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      if (!warning) arm();
    };

    arm();
    for (const event of EVENTS) window.addEventListener(event, onActivity, { passive: true });

    return () => {
      for (const event of EVENTS) window.removeEventListener(event, onActivity);
      if (timer.current) clearTimeout(timer.current);
      if (countdown.current) clearInterval(countdown.current);
    };
    // `warning` is read inside the handler; re-arming on every change would
    // reset the countdown the moment it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arm, signOut]);

  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-[98] grid place-items-center bg-ink-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900 p-5 text-center shadow-2xl">
        <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-amber-500/15 text-amber-300">
          <Clock className="h-5 w-5" />
        </span>
        <h2 className="text-[15px] font-bold">নিষ্ক্রিয়তার কারণে লগআউট হচ্ছে</h2>
        <p className="mt-1 text-[12px] text-sand-100/55">
          {secondsLeft} সেকেন্ডের মধ্যে কিছু না করলে স্বয়ংক্রিয়ভাবে লগআউট হবে।
        </p>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / (WARN_MS / 1000)) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
              arm();
            }}
            className="btn-primary flex-1 rounded-xl py-2 text-[12.5px]"
          >
            আমি এখানেই আছি
          </button>
          <button onClick={() => void signOut()} className="btn-ghost flex-1 rounded-xl py-2 text-[12.5px]">
            <LogOut className="h-3.5 w-3.5" /> লগআউট
          </button>
        </div>
      </div>
    </div>
  );
}
