"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { Spinner } from "./ui";

export function ContactForm() {
  const { t } = useLocale();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        throw new Error(json.message ?? "বার্তা পাঠানো যায়নি");
      }
      setSent(true);
      setForm({ name: "", email: "", phone: "", message: "" });
      toast.success(t("বার্তা পাঠানো হয়েছে", "Message sent"), t("শীঘ্রই যোগাযোগ করব।", "We'll get back to you shortly."));
    } catch (err) {
      toast.error(t("পাঠানো যায়নি", "Could not send"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6">
      <h2 className="text-[16px] font-bold">{t("বার্তা পাঠান", "Send us a message")}</h2>
      <p className="mt-1 text-[12px] text-sand-100/50">
        {t("নিচের ফর্মটি পূরণ করুন, আমরা দ্রুত উত্তর দেব।", "Fill in the form and we'll respond quickly.")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">{t("আপনার নাম", "Your name")} *</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            placeholder={t("পুরো নাম", "Full name")}
          />
          {errors.name ? <p className="mt-1 text-[11px] text-red-300">{errors.name}</p> : null}
        </label>
        <label>
          <span className="label">{t("মোবাইল", "Mobile")}</span>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="input"
            inputMode="tel"
            placeholder="01712345678"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="label">{t("ইমেইল", "Email")}</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
            placeholder="you@example.com"
          />
          {errors.email ? <p className="mt-1 text-[11px] text-red-300">{errors.email}</p> : null}
        </label>
        <label className="sm:col-span-2">
          <span className="label">{t("বার্তা", "Message")} *</span>
          <textarea
            required
            rows={5}
            maxLength={1200}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="input resize-none"
            placeholder={t("কীভাবে সাহায্য করতে পারি?", "How can we help?")}
          />
          {errors.message ? <p className="mt-1 text-[11px] text-red-300">{errors.message}</p> : null}
        </label>
      </div>

      <button type="submit" disabled={loading} className="btn-primary mt-4 w-full sm:w-auto">
        {loading ? <Spinner /> : <Send className="h-4 w-4" />}
        {sent ? t("আরেকটি বার্তা পাঠান", "Send another message") : t("বার্তা পাঠান", "Send message")}
      </button>

      <p className="mt-3 text-[10.5px] leading-relaxed text-sand-100/35">
        {t("আপনার তথ্য শুধুমাত্র যোগাযোগের জন্য ব্যবহৃত হবে।", "Your details are used only to reply to you.")}
      </p>
    </form>
  );
}
