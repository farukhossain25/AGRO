"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { StarRating, Spinner } from "./ui";

export function ReviewForm({ productId }: { productId: string | null }) {
  const { t } = useLocale();
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { user, loading: authLoading } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId ?? "00000000-0000-4000-8000-000000000000",
          name_bn: name,
          location_bn: location,
          rating,
          comment,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const firstError = json.errors ? Object.values(json.errors)[0] : json.message;
        throw new Error(String(firstError ?? "সমস্যা হয়েছে"));
      }
      setDone(true);
      setName("");
      setLocation("");
      setComment("");
      setRating(5);
      toast.success(
        t("ধন্যবাদ! আপনার মতামত পেয়েছি", "Thanks! Your review was received"),
        t("আপনার মতামত এখনই প্রকাশিত হয়েছে।", "Your review is live now.")
      );
    } catch (err) {
      toast.error(t("মতামত পাঠানো যায়নি", "Could not submit review"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /* The API requires a session now (an anonymous review was untraceable and
     unbounded). Show the login link instead of a form that would 401. */
  if (!authLoading && !user) {
    return (
      <div className="card p-5 text-center sm:p-6">
        <h3 className="text-[15px] font-semibold">
          {t("আপনার মতামত দিন", "Share your experience")}
        </h3>
        <p className="mt-1 text-[12.5px] text-sand-100/55">
          {t("রিভিউ দিতে লগইন করুন — এতে আপনার মতামত যাচাইযোগ্য থাকে।", "Log in to review — it keeps reviews accountable.")}
        </p>
        <Link href="/login?next=/products" className="btn-primary btn-sm mx-auto mt-4">
          {t("লগইন করুন", "Log in")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold">
        {t("আপনার মতামত দিন", "Share your experience")}
      </h3>
      <p className="mt-1 text-[12px] text-sand-100/50">
        {t("আপনার রিভিউ অন্যদের সিদ্ধান্ত নিতে সাহায্য করে।", "Your review helps other families decide.")}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-[12.5px] text-sand-100/60">{t("রেটিং", "Rating")}:</span>
        <StarRating value={rating} onChange={setRating} size={22} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">{t("আপনার নাম", "Your name")} *</span>
          <input
            required
            minLength={2}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder={t("যেমন: রফিকুল ইসলাম", "e.g. Rafiqul Islam")}
          />
        </label>
        <label>
          <span className="label">{t("এলাকা", "Area")}</span>
          <input
            maxLength={60}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="input"
            placeholder={t("যেমন: উত্তরা, ঢাকা", "e.g. Uttara, Dhaka")}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="label">{t("আপনার মতামত", "Your review")} *</span>
        <textarea
          required
          minLength={5}
          maxLength={600}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="input resize-none"
          placeholder={t("পণ্যের কোয়ালিটি ও ডেলিভারি নিয়ে লিখুন…", "Tell us about quality and delivery…")}
        />
      </label>

      <button type="submit" disabled={loading} className="btn-primary mt-4 w-full sm:w-auto">
        {loading ? <Spinner /> : <Send className="h-4 w-4" />}
        {done ? t("আরেকটি পাঠান", "Send another") : t("মতামত পাঠান", "Submit review")}
      </button>
    </form>
  );
}
