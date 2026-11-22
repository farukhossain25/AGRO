"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";
import { Spinner } from "@/components/ui";
import type { PublicPaymentMethod } from "@/lib/types";

/* ==========================================================================
   ManualPaymentForm — "send money, then prove it"
   --------------------------------------------------------------------------
   The screen the brief describes, in order:

     1. the receiving number, huge, with a copy button
     2. the exact amount to pay
     3. short Bangla instructions
     4. the proof form (sender number, TrxID, amount, time, screenshot)

   Client-side validation is convenience only. The server re-validates every
   field and — importantly — re-computes the amount it expects, so editing the
   amount in devtools produces a clear error rather than a wrong charge.
   ========================================================================== */

type Props = {
  methods: PublicPaymentMethod[];
  expected: number;
  orderNo?: string;
  subNo?: string;
  initialMethod?: string;
  customer: { name: string; phone: string };
};

export function ManualPaymentForm({ methods, expected, orderNo, subNo, initialMethod, customer }: Props) {
  const toast = useToast();

  const [methodCode, setMethodCode] = useState(
    initialMethod && methods.some((m) => m.code === initialMethod) ? initialMethod : methods[0]?.code ?? ""
  );
  const method = useMemo(() => methods.find((m) => m.code === methodCode), [methods, methodCode]);

  const [senderNumber, setSenderNumber] = useState(customer.phone);
  const [trx, setTrx] = useState("");
  const [amount, setAmount] = useState(String(expected));
  const [paidAt, setPaidAt] = useState("");
  const [proof, setProof] = useState<{ path: string; preview: string } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ payment_no: string; status_url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyNumber() {
    if (!method?.account_number) return;
    try {
      await navigator.clipboard.writeText(method.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("কপি করা যায়নি", "নম্বরটি হাতে লিখে নিন");
    }
  }

  async function uploadProof(file: File) {
    setUploading(true);
    setErrors((e) => ({ ...e, screenshot: "" }));
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/payments/upload-proof", { method: "POST", body });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "আপলোড ব্যর্থ");
      setProof({ path: json.data.path, preview: URL.createObjectURL(file) });
    } catch (error) {
      setErrors((e) => ({ ...e, screenshot: (error as Error).message }));
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch("/api/payments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          methodCode,
          orderNo,
          subNo,
          senderNumber,
          trxId: trx,
          amount: Number(amount),
          paidAt: paidAt || undefined,
          screenshotPath: proof?.path,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        throw new Error(json.message ?? "জমা দেওয়া যায়নি");
      }

      setResult({ payment_no: json.data.payment_no, status_url: json.data.status_url });
      toast.success("পেমেন্ট জমা হয়েছে", "যাচাইয়ের পর জানানো হবে");
    } catch (error) {
      toast.error("জমা হয়নি", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  /* ------------------------------------------------------------- success */
  if (result) {
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-amber-500/15 text-amber-300">
          <ShieldCheck className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-bold">পেমেন্ট জমা হয়েছে ✅</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-sand-100/55">
          আপনার TrxID আমাদের কাছে পৌঁছেছে। যাচাই শেষে অর্ডার নিশ্চিত হবে — সাধারণত ১৫ মিনিটের মধ্যে,
          কাজের সময়ে।
        </p>

        <div className="mt-4 rounded-xl bg-white/[0.04] p-3 text-left text-[11.5px]">
          <p className="flex justify-between">
            <span className="text-sand-100/45">পেমেন্ট নম্বর</span>
            <span className="font-mono font-semibold text-leaf-200">{result.payment_no}</span>
          </p>
          <p className="mt-1.5 flex justify-between">
            <span className="text-sand-100/45">পরিমাণ</span>
            <span className="font-semibold">{money(expected)}</span>
          </p>
          <p className="mt-1.5 flex justify-between">
            <span className="text-sand-100/45">অবস্থা</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              যাচাই চলছে
            </span>
          </p>
        </div>

        <Link href={result.status_url} className="btn-primary mt-4 w-full justify-center">
          <BadgeCheck className="h-4 w-4" /> লাইভ অবস্থা দেখুন
        </Link>
        <Link href="/account" className="btn-ghost mt-2 w-full justify-center text-[12.5px]">
          আমার অর্ডার
        </Link>
      </div>
    );
  }

  /* ---------------------------------------------------------------- form */
  const needsTrx = method?.requires_trx ?? true;
  const needsSender = method?.requires_sender ?? true;

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4">
      {/* ---- 1. method picker (only when more than one is enabled) */}
      {methods.length > 1 ? (
        <div className="card p-3">
          <p className="mb-2 text-[11.5px] font-semibold text-sand-100/60">কোন মাধ্যমে টাকা পাঠাবেন?</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethodCode(m.code)}
                aria-pressed={m.code === methodCode}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                  m.code === methodCode
                    ? "border-leaf-500/70 bg-leaf-600/10"
                    : "border-white/10 hover:border-white/25"
                }`}
              >
                {m.logo_url ? (
                  <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded bg-white/10">
                    <Image src={m.logo_url} alt="" fill sizes="20px" className="object-contain" />
                  </span>
                ) : (
                  <Smartphone className="h-3.5 w-3.5 shrink-0 text-leaf-300" />
                )}
                <span className="truncate text-[11.5px] font-medium">{m.name_bn}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- 2. the receiving number, the amount, the instructions */}
      {method ? (
        <div className="card overflow-hidden p-0">
          <div className="bg-gradient-to-br from-leaf-800/70 to-ink-850 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-leaf-200/70">
              {method.kind === "bank" ? "এই অ্যাকাউন্টে টাকা পাঠান" : "এই নম্বরে Send Money করুন"}
            </p>

            <div className="mt-1.5 flex items-center gap-2">
              <p className="font-mono text-[clamp(1.25rem,6vw,1.9rem)] font-bold tracking-wide">
                {method.account_number ?? "—"}
              </p>
              {method.account_number ? (
                <button
                  type="button"
                  onClick={copyNumber}
                  className={`rounded-lg p-2 transition ${
                    copied ? "bg-leaf-500/30 text-leaf-100" : "bg-white/10 text-sand-100/70 hover:bg-white/20"
                  }`}
                  aria-label="নম্বর কপি করুন"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              ) : null}
            </div>

            <p className="mt-1 text-[11.5px] text-sand-100/60">
              {[method.account_name, method.account_type, method.bank_name, method.branch_name]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="mt-3 flex items-end justify-between rounded-xl bg-ink-950/40 px-3 py-2 backdrop-blur-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-sand-100/45">যত টাকা পাঠাতে হবে</p>
                <p className="text-xl font-bold text-leaf-200">{money(expected)}</p>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                {method.kind === "bank" ? "Bank transfer" : "Send Money"}
              </span>
            </div>
          </div>

          {method.instruction_bn ? (
            <p className="border-t border-white/[0.06] px-4 py-3 text-[11.5px] leading-relaxed text-sand-100/60">
              {method.instruction_bn}
            </p>
          ) : null}

          <p className="flex items-start gap-1.5 border-t border-amber-500/20 bg-amber-500/[0.07] px-4 py-2.5 text-[11px] leading-relaxed text-amber-200/85">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ঠিক {money(expected)} পাঠাবেন — কম বা বেশি পাঠালে যাচাই আটকে যাবে।
          </p>
        </div>
      ) : (
        <div className="card p-4 text-[12.5px] text-sand-100/50">কোনো পেমেন্ট মাধ্যম চালু নেই।</div>
      )}

      {/* ---- 3. proof */}
      <div className="card space-y-3 p-4">
        <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold">
          <Lock className="h-3.5 w-3.5 text-leaf-300" /> টাকা পাঠানোর প্রমাণ দিন
        </h2>

        {needsSender ? (
          <Field label="যে নম্বর থেকে টাকা পাঠিয়েছেন" error={errors.senderNumber}>
            <input
              className="inp"
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value.replace(/[^0-9+]/g, ""))}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
              maxLength={14}
            />
          </Field>
        ) : null}

        {needsTrx ? (
          <Field
            label="Transaction ID (TrxID)"
            error={errors.trxId}
            hint="মেসেজ অথবা অ্যাপের রিসিটে TrxID দেখুন — এটি একটি অর্ডারে একবারই ব্যবহার করা যায়"
          >
            <input
              className="inp font-mono uppercase tracking-wider"
              value={trx}
              onChange={(e) => setTrx(e.target.value.toUpperCase())}
              placeholder="8N7A2K4L"
              maxLength={40}
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="টাকার পরিমাণ" error={errors.amount}>
            <input
              className="inp"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
            />
          </Field>
          <Field label="কখন পাঠিয়েছেন (ঐচ্ছিক)">
            <input
              className="inp"
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </Field>
        </div>

        {/* screenshot — private bucket, owner-only */}
        <div>
          <p className="mb-1 text-[11.5px] font-medium text-sand-100/70">
            স্ক্রিনশট (জরুরি নয়, তবে যাচাই দ্রুত হয়)
          </p>
          {proof ? (
            <div className="relative flex items-center gap-2 rounded-xl bg-white/[0.04] p-2">
              <img src={proof.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <p className="flex-1 text-[11px] text-leaf-200">সংযুক্ত হয়েছে ✅</p>
              <button type="button" onClick={() => setProof(null)} className="p-1 text-sand-100/40" aria-label="সরান">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/12 bg-white/[0.03] text-[11.5px] text-sand-100/45 transition hover:border-leaf-500/50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? "আপলোড হচ্ছে…" : "ছবি বাছুন (গ্যালারি/ক্যামেরা)"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadProof(file);
                }}
              />
            </label>
          )}
          {errors.screenshot ? <p className="mt-1 text-[10.5px] text-red-300">{errors.screenshot}</p> : null}
        </div>

        <button
          type="submit"
          disabled={submitting || uploading || !method}
          className="btn-primary w-full justify-center !py-3 text-[14px]"
        >
          {submitting ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          যাচাইয়ের জন্য জমা দিন
        </button>

        <p className="text-center text-[10.5px] leading-relaxed text-sand-100/30">
          জমা দেওয়ার পর আমাদের টিম TrxID মিলিয়ে দেখবে। ভুয়া TrxID দিলে অ্যাকাউন্ট সাময়িকভাবে বন্ধ হতে পারে।
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11.5px] font-medium text-sand-100/70">{label}</span>
      {children}
      {hint ? <span className="block text-[10px] text-sand-100/35">{hint}</span> : null}
      {error ? <span className="block text-[10.5px] text-red-300">{error}</span> : null}
    </label>
  );
}
