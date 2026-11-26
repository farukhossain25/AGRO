"use client";

import { useState } from "react";
import { Check, Mail, Send } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   NewsletterSignup — "সাপ্তাহিক তাজা খবর"
   --------------------------------------------------------------------------
   Lives where the homepage used to end with a large BOGO-style CTA panel.
   The owner wanted that panel gone (it ate a whole phone screen and repeated
   buttons the page already had) and replaced by ONE line of email capture —
   the same promise the footer makes, in a third of the space.

   TWO LAYOUTS, ONE COMPONENT
     `variant="section"`  a slim band on the homepage: icon + heading + the
                          form on one line from sm, two lines on a phone.
     `variant="card"`     the footer's raised card (kept as it was).

   The API is the existing POST /api/newsletter; a duplicate email answers
   `{ already: true }` and is treated as success, not as an error — telling a
   returning reader "already subscribed" is friendlier than a red toast.
   ========================================================================== */

export function NewsletterSignup({ variant = "section" }: { variant?: "section" | "card" }) {
  const { t } = useLocale();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || t("সমস্যা হয়েছে", "Something went wrong"));
      toast.success(
        json?.data?.already
          ? t("আপনি আগেই সাবস্ক্রাইব করেছেন", "You're already subscribed")
          : t("সাবস্ক্রাইব সম্পন্ন!", "You're subscribed!"),
        t("ধন্যবাদ — প্রতি সপ্তাহে তাজা খবর পাবেন।", "Thanks — fresh news every week.")
      );
      setEmail("");
      setDone(true);
    } catch (err) {
      toast.error(t("সাবস্ক্রাইব ব্যর্থ", "Subscription failed"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <form onSubmit={subscribe} className="flex w-full gap-2">
      <label className="relative min-w-0 flex-1">
        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neu-faint" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("আপনার ইমেইল", "Your email")}
          className="input !rounded-full !pl-11"
          aria-label={t("ইমেইল ঠিকানা", "Email address")}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="btn-primary shrink-0 !px-4 sm:!px-5"
        aria-label={t("সাবস্ক্রাইব করুন", "Subscribe")}
      >
        {loading ? <Spinner /> : done ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        <span className="hidden sm:inline">{t("সাবস্ক্রাইব", "Subscribe")}</span>
      </button>
    </form>
  );

  if (variant === "card") {
    return (
      <div className="card rounded-[26px] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-leaf-600/15 text-neu-accent-strong"
            aria-hidden
          >
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold leading-tight tracking-tight sm:text-[20px]">
              {t("সাপ্তাহিক তাজা খবর", "Fresh news, weekly")}
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-neu-muted">
              {t(
                "মৌসুমি সবজি, রেসিপি ও এক্সক্লুসিভ ছাড় — সবার আগে আপনার ইনবক্সে।",
                "Seasonal produce, recipes and exclusive discounts, first in your inbox."
              )}
            </p>
          </div>
        </div>
        <div className="mt-5">{form}</div>
        <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-neu-faint">
          <Check className="mt-[2px] h-3 w-3 shrink-0 text-neu-accent" aria-hidden />
          {t(
            "সপ্তাহে একটাই মেইল, কোনো স্প্যাম নেই — যেকোনো সময় আনসাবস্ক্রাইব।",
            "One email a week, no spam — unsubscribe anytime."
          )}
        </p>
      </div>
    );
  }

  /* ---------------- slim homepage band ---------------- */
  return (
    <section className="container-x pb-6 pt-2" aria-labelledby="newsletter-heading">
      <div className="card relative overflow-hidden rounded-[24px] px-4 py-4 sm:px-6 sm:py-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-leaf-500/15 blur-2xl"
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex min-w-0 items-center gap-3 sm:w-[46%]">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-600/15 text-neu-accent-strong"
              aria-hidden
            >
              <Mail className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="newsletter-heading" className="text-[14px] font-bold leading-tight">
                {t("সাপ্তাহিক তাজা খবর", "Fresh news, weekly")}
              </h2>
              <p className="mt-0.5 text-[11.5px] leading-snug text-neu-muted">
                {t(
                  "মৌসুমি সবজি, রেসিপি ও এক্সক্লুসিভ ছাড় — সবার আগে আপনার ইনবক্সে।",
                  "Seasonal produce, recipes and exclusive discounts, first in your inbox."
                )}
              </p>
            </div>
          </div>
          <div className="sm:flex-1">{form}</div>
        </div>
        <p className="relative mt-2.5 flex items-center gap-1.5 pl-[52px] text-[10.5px] leading-relaxed text-neu-faint sm:mt-2">
          <Check className="h-3 w-3 shrink-0 text-neu-accent" aria-hidden />
          {t(
            "সপ্তাহে একটাই মেইল, কোনো স্প্যাম নেই — যেকোনো সময় আনসাবস্ক্রাইব।",
            "One email a week, no spam — unsubscribe anytime."
          )}
        </p>
      </div>
    </section>
  );
}
