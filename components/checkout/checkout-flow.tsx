"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  CreditCard,
  Lock,
  ShieldCheck,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useDeliveryConfig } from "@/lib/delivery-settings";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";
import { divisionNames, districtsOf, upazilasOf, dhakaMetroThanas } from "@/lib/bd-locations";
import type { PublicPaymentMethod } from "@/lib/types";
import { EmptyState, Spinner } from "@/components/ui";

/* ==========================================================================
   CheckoutFlow — professional 3-step checkout
   --------------------------------------------------------------------------
   Step 1  delivery address + coupon
   Step 2  payment method (cards built from the admin-managed methods)
   Step 3  confirmation + place order

   The customer picks a method from the admin panel's active list. COD goes
   straight to order-success; every other method goes to the payment page
   where the receiving number and instructions are shown.
   ========================================================================== */

type Step = 1 | 2 | 3;

const METHOD_EMOJI: Record<string, string> = {
  bkash: "🟢",
  nagad: "🟡",
  rocket: "🚀",
  upay: "💳",
  bank: "🏦",
  cod: "💵",
  sslcommerz: "🏦",
};

export function CheckoutFlow({ methods: initialMethods }: { methods: PublicPaymentMethod[] }) {
  /* If the database returned nothing (outage, or a brand-new project), fall
     back to cash-on-delivery only. Never invent a wallet flow without a
     receiving number — the customer would have nowhere to send the money. */
  const methods: PublicPaymentMethod[] = initialMethods.length
    ? initialMethods
    : [
        {
          id: "fallback-cod",
          code: "cod",
          name_bn: "ক্যাশ অন ডেলিভারি",
          name_en: "Cash on delivery",
          kind: "cod",
          logo_url: null,
          account_type: null,
          account_number: null,
          account_name: null,
          bank_name: null,
          branch_name: null,
          instruction_bn: "পণ্য হাতে পেয়ে টাকা দিন।",
          min_amount: 0,
          max_amount: null,
          requires_trx: false,
          requires_sender: false,
        },
      ];

  const cart = useCart();
  const rules = useDeliveryConfig();
  const { t, isBn } = useLocale();
  const toast = useToast();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    email: "",
    division: "",
    district: "",
    upazila: "",
    address: "",
    delivery_note: "",
  });
  const [payment, setPayment] = useState<string>(
    methods.find((m) => m.code === "cod")?.code ?? methods[0]?.code ?? ""
  );
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [unavailable, setUnavailable] = useState<
    Array<{ id: string; name: string; reason: string; slug?: string }>
  >([]);

  const districtList = useMemo(() => (form.division ? districtsOf(form.division) : []), [form.division]);
  const upazilaList = useMemo(
    () => (form.division && form.district ? upazilasOf(form.division, form.district) : []),
    [form.division, form.district]
  );

  const isInsideDhaka = form.division === "ঢাকা" && dhakaMetroThanas.has(form.upazila);
  const baseDelivery = isInsideDhaka
    ? rules.inside_dhaka
    : form.district
      ? rules.outside_dhaka
      : 0;
  const freeDelivery = cart.subtotal >= rules.free_over;
  const delivery = cart.items.some((l) => l.kind === "combo") ? 0 : freeDelivery ? 0 : baseDelivery;
  const total = Math.max(0, cart.subtotal + delivery - discount);

  const selectedMethod = methods.find((m) => m.code === payment) ?? methods[0];

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (form.customer_name.trim().length < 2) e.customer_name = "পুরো নাম দিন";
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(form.phone.replace(/[\s-]/g, ""))) e.phone = "সঠিক মোবাইল নম্বর দিন";
    if (!form.division) e.division = "বিভাগ নির্বাচন করুন";
    if (!form.district) e.district = "জেলা নির্বাচন করুন";
    if (!form.upazila) e.upazila = "উপজেলা নির্বাচন করুন";
    if (form.address.trim().length < 8) e.address = "সম্পূর্ণ ঠিকানা লিখুন";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon.trim(), subtotal: cart.subtotal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "কুপন সঠিক নয়");
      setDiscount(json.data.discount);
      setAppliedCoupon(json.data.code);
      toast.success(t("কুপন প্রয়োগ হয়েছে", "Coupon applied"), `${json.data.code} — ${money(json.data.discount, isBn)}`);
    } catch (err) {
      setDiscount(0);
      setAppliedCoupon(null);
      toast.error(t("কুপন কাজ করেনি", "Coupon failed"), (err as Error).message);
    } finally {
      setCouponLoading(false);
    }
  }

  async function placeOrder() {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          payment_method: payment,
          coupon_code: appliedCoupon ?? "",
          items: cart.items.map((l) => ({
            id: l.id,
            kind: l.kind,
            quantity: l.quantity,
            slug: l.slug,
            name: isBn ? l.nameBn : l.nameEn,
          })),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        if (Array.isArray(json.unavailable) && json.unavailable.length) {
          setUnavailable(json.unavailable);
        }
        throw new Error(json.message ?? "অর্ডার সম্পন্ন হয়নি");
      }
      setUnavailable([]);

      const { order_no } = json.data;
      cart.clear();

      // COD needs no payment step; every other method shows the receiving
      // number + instructions on the payment page.
      if (payment === "cod") {
        window.location.href = `/order-success?order=${order_no}`;
      } else {
        window.location.href = `/payment/${encodeURIComponent(payment)}?order=${order_no}`;
      }
    } catch (err) {
      toast.error(t("অর্ডার ব্যর্থ হয়েছে", "Order failed"), (err as Error).message);
      setSubmitting(false);
    }
  }

  if (!cart.ready) return <CheckoutSkeleton />;

  if (cart.items.length === 0) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon="🛒"
          title={t("চেকআউট করার জন্য কার্ট খালি", "Nothing to check out")}
          body={t("প্রথমে কিছু পণ্য কার্টে যোগ করুন।", "Add some products to your cart first.")}
          action={<Link href="/products" className="btn-primary">পণ্য দেখুন</Link>}
        />
      </div>
    );
  }

  const steps = [
    { n: 1, label: t("ঠিকানা", "Address") },
    { n: 2, label: t("পেমেন্ট", "Payment") },
    { n: 3, label: t("নিশ্চিতকরণ", "Confirm") },
  ];

  return (
    <div className="container-x py-7 sm:py-10">
      {/* ── header ───────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold sm:text-3xl">{t("চেকআউট", "Checkout")}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-sand-100/45">
          <ShieldCheck className="h-3.5 w-3.5 text-leaf-400" />
          {t("নিরাপদ চেকআউট · তথ্য এন্ক্রিপ্ট করা হয়েছে", "Secure checkout · your data is encrypted")}
        </p>
      </div>

      {unavailable.length ? (
        <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
          <p className="text-[13px] font-semibold text-red-200">
            {t(
              "এই পণ্যগুলো এখন পাওয়া যাচ্ছে না — সরিয়ে দিলেই অর্ডার সম্পন্ন হবে",
              "These items are no longer available — remove them to continue"
            )}
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-red-100/80">
            {unavailable.map((u) => (
              <li key={u.id}>• {u.name} — {u.reason}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              unavailable.forEach((u) => cart.remove(u.id));
              setUnavailable([]);
              toast.success(t("অপ্রাপ্য পণ্য সরানো হয়েছে", "Unavailable items removed"));
            }}
            className="btn-ghost btn-sm mt-3 !border-red-300/30 !text-red-100"
          >
            {t("সরিয়ে ফেলুন", "Remove them")}
          </button>
        </div>
      ) : null}

      {/* ── step indicator ──────────────────────────────────────────────── */}
      <ol className="mb-6 flex items-center gap-2 text-[11.5px]">
        {steps.map((s, i) => (
          <li key={s.n} className="flex flex-1 items-center gap-2">
            <button
              onClick={() => setStep(s.n as Step)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-semibold transition ${
                step >= s.n ? "bg-leaf-600/20 text-leaf-200" : "text-sand-100/40"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                  step >= s.n ? "bg-leaf-500 text-ink-900" : "bg-white/10"
                }`}
              >
                {step > s.n ? <Check className="h-3 w-3" /> : s.n}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 ? (
              <span className={`h-px flex-1 ${step > s.n ? "bg-leaf-500/50" : "bg-white/10"}`} />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* ── LEFT: step content ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* STEP 1: address */}
          <section className={`card overflow-hidden ${step !== 1 ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-leaf-600/20 text-[11px] text-leaf-200">1</span>
                {t("ডেলিভারি ঠিকানা", "Delivery address")}
              </h2>
              {step !== 1 ? (
                <button onClick={() => setStep(1)} className="text-[12px] font-semibold text-leaf-300">
                  {t("পরিবর্তন", "Edit")}
                </button>
              ) : null}
            </div>

            {step === 1 ? (
              <div className="space-y-3.5 p-5">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <label>
                    <span className="label">{t("পুরো নাম", "Full name")} *</span>
                    <input
                      value={form.customer_name}
                      onChange={(e) => update("customer_name", e.target.value)}
                      className="input"
                      placeholder={t("যেমন: রফিকুল ইসলাম", "e.g. Rafiqul Islam")}
                      autoComplete="name"
                    />
                    {errors.customer_name ? <p className="mt-1 text-[11px] text-red-300">{errors.customer_name}</p> : null}
                  </label>

                  <label>
                    <span className="label">{t("মোবাইল নম্বর", "Mobile number")} *</span>
                    <input
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className="input"
                      inputMode="tel"
                      placeholder="01712345678"
                      autoComplete="tel"
                    />
                    {errors.phone ? <p className="mt-1 text-[11px] text-red-300">{errors.phone}</p> : null}
                  </label>

                  <label>
                    <span className="label">{t("ইমেইল (ঐচ্ছিক)", "Email (optional)")}</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      className="input"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    {errors.email ? <p className="mt-1 text-[11px] text-red-300">{errors.email}</p> : null}
                  </label>

                  <label>
                    <span className="label">{t("বিভাগ", "Division")} *</span>
                    <select
                      value={form.division}
                      onChange={(e) => {
                        update("division", e.target.value);
                        update("district", "");
                        update("upazila", "");
                      }}
                      className="input"
                    >
                      <option value="">{t("নির্বাচন করুন", "Select")}</option>
                      {divisionNames.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {errors.division ? <p className="mt-1 text-[11px] text-red-300">{errors.division}</p> : null}
                  </label>

                  <label>
                    <span className="label">{t("জেলা", "District")} *</span>
                    <select
                      value={form.district}
                      onChange={(e) => {
                        update("district", e.target.value);
                        update("upazila", "");
                      }}
                      className="input"
                      disabled={!form.division}
                    >
                      <option value="">{t("নির্বাচন করুন", "Select")}</option>
                      {districtList.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {errors.district ? <p className="mt-1 text-[11px] text-red-300">{errors.district}</p> : null}
                  </label>

                  <label>
                    <span className="label">{t("উপজেলা", "Upazila")} *</span>
                    <select
                      value={form.upazila}
                      onChange={(e) => update("upazila", e.target.value)}
                      className="input"
                      disabled={!form.district}
                    >
                      <option value="">{t("নির্বাচন করুন", "Select")}</option>
                      {upazilaList.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    {errors.upazila ? <p className="mt-1 text-[11px] text-red-300">{errors.upazila}</p> : null}
                  </label>
                </div>

                <label>
                  <span className="label">{t("সম্পূর্ণ ঠিকানা", "Full address")} *</span>
                  <textarea
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    className="input min-h-[84px] resize-y"
                    placeholder={t("ঘর/ফ্লাট, রাস্তা, এলাকা — ডেলিভারির জন্য প্রস্তুত", "House/flat, street, area — delivery-ready")}
                  />
                  {errors.address ? <p className="mt-1 text-[11px] text-red-300">{errors.address}</p> : null}
                </label>

                <label>
                  <span className="label">{t("ডেলিভারি নোট (ঐচ্ছিক)", "Delivery note (optional)")}</span>
                  <textarea
                    value={form.delivery_note}
                    onChange={(e) => update("delivery_note", e.target.value)}
                    className="input min-h-[64px] resize-y"
                    placeholder={t("যেমন: দুপুর 2–4 টার মধ্যে পাঠান", "e.g. deliver between 2–4 pm")}
                  />
                </label>

                {/* coupon */}
                <div className="flex gap-2">
                  <input
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    className="input flex-1"
                    placeholder={t("কুপন কোড (ঐচ্ছিক)", "Coupon code (optional)")}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponLoading || !coupon.trim()}
                    className="btn-secondary shrink-0"
                  >
                    {couponLoading ? <Spinner className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
                    {t("প্রয়োগ", "Apply")}
                  </button>
                </div>
                {appliedCoupon ? (
                  <p className="flex items-center gap-1.5 text-[12px] text-leaf-300">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {t("কুপন প্রয়োগ হয়েছে", "Coupon applied")}: <strong>{appliedCoupon}</strong> — −{money(discount, isBn)}
                    <button
                      type="button"
                      onClick={() => {
                        setCoupon("");
                        setAppliedCoupon(null);
                        setDiscount(0);
                      }}
                      className="ml-1 text-sand-100/50 hover:text-red-300"
                    >
                      <X className="inline h-3.5 w-3.5" />
                    </button>
                  </p>
                ) : null}

                <div className="flex justify-end pt-1">
                  <button type="button" onClick={() => (validateStep1() ? setStep(2) : null)} className="btn-primary">
                    {t("পেমেন্ট স্টেপে যান", "Continue to payment")}
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 text-[13px] text-sand-100/70">
                <p className="font-medium text-sand-100/90">{form.customer_name}</p>
                <p className="mt-0.5">{form.phone}</p>
                {form.email ? <p className="mt-0.5 text-sand-100/50">{form.email}</p> : null}
                <p className="mt-1.5">
                  {form.division} · {form.district} · {form.upazila}
                </p>
                <p className="mt-0.5">{form.address}</p>
                {form.delivery_note ? <p className="mt-1 text-sand-100/50">📝 {form.delivery_note}</p> : null}
                {appliedCoupon ? (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-leaf-600/15 px-2.5 py-1 text-[11px] font-semibold text-leaf-200">
                    <Tag className="h-3 w-3" /> {appliedCoupon} — −{money(discount, isBn)}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {/* STEP 2: payment method */}
          <section className={`card overflow-hidden ${step !== 2 ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-leaf-600/20 text-[11px] text-leaf-200">2</span>
                {t("পেমেন্ট মাধ্যম", "Payment method")}
              </h2>
              {step !== 2 ? (
                <button onClick={() => setStep(2)} className="text-[12px] font-semibold text-leaf-300">
                  {t("পরিবর্তন", "Edit")}
                </button>
              ) : null}
            </div>

            {step === 2 ? (
              <div className="space-y-3 p-5">
                {/* hint */}
                <p className="text-[11.5px] text-sand-100/45">
                  {t("পেমেন্ট মাধ্যম বেছে নিন — এক ক্লিকে নির্দেশনা পাবেন", "Pick a payment method — you'll get instructions in one click")}
                </p>

                {methods.map((m) => {
                  const selected = m.code === payment;
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => setPayment(m.code)}
                      className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-leaf-500 bg-leaf-600/[0.08] ring-2 ring-leaf-500/40"
                          : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-2xl ${
                          selected ? "bg-leaf-600/20" : "bg-white/5"
                        }`}
                      >
                        {m.logo_url ? (
                          <Image src={m.logo_url} alt={m.name_bn} fill className="object-contain" unoptimized />
                        ) : (
                          <span aria-hidden>{METHOD_EMOJI[m.code] ?? "💳"}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-bold">{m.name_bn}</p>
                          {m.name_en ? <p className="text-[11px] text-sand-100/40">{m.name_en}</p> : null}
                        </div>
                        {m.kind === "cod" ? (
                          <p className="mt-1 text-[12px] text-sand-100/55">
                            {m.instruction_bn ?? t("পণ্য হাতে পেয়ে টাকা দিন।", "Pay when you receive your order.")}
                          </p>
                        ) : (
                          <p className="mt-1 truncate font-mono text-[12.5px] text-leaf-200/90">
                            {m.account_number ?? m.bank_name ?? "—"}
                          </p>
                        )}
                      </div>
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${
                          selected ? "border-leaf-500 bg-leaf-500 text-ink-900" : "border-white/15 text-transparent"
                        }`}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    </button>
                  );
                })}

                <p className="flex items-center gap-1.5 pt-1 text-[11.5px] text-sand-100/40">
                  <Lock className="h-3 w-3 text-leaf-400" />
                  {t("টাকা পাঠানোর পর অর্ডার আপডেট করতে অ্যাডমিন যাচাই করবেন", "The admin verifies payment before your order is confirmed.")}
                </p>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!payment) {
                        toast.error(t("পেমেন্ট মাধ্যম বেছে নিন", "Pick a payment method"));
                        return;
                      }
                      setStep(3);
                    }}
                    className="btn-primary"
                  >
                    {t("পেমেন্ট করুন", "Pay now")}
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center gap-3 rounded-xl border border-leaf-500/30 bg-leaf-600/[0.06] p-4">
                  <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl text-xl bg-leaf-600/15">
                    {selectedMethod?.logo_url ? (
                      <Image src={selectedMethod.logo_url} alt={selectedMethod.name_bn} fill className="object-contain" unoptimized />
                    ) : (
                      <span aria-hidden>{METHOD_EMOJI[selectedMethod?.code ?? ""] ?? "💳"}</span>
                    )}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">{selectedMethod?.name_bn}</p>
                    {selectedMethod?.kind !== "cod" && selectedMethod?.account_number ? (
                      <p className="mt-0.5 font-mono text-[12px] text-leaf-200/80">{selectedMethod.account_number}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STEP 3: confirmation */}
          {step === 3 ? (
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
                <h2 className="flex items-center gap-2 text-[15px] font-bold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-leaf-600/20 text-[11px] text-leaf-200">3</span>
                  {t("অর্ডার নিশ্চিত করুন", "Confirm your order")}
                </h2>
              </div>
              <div className="space-y-4 p-5">
                {/* address recap */}
                <div className="rounded-xl border border-white/10 p-3.5">
                  <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">{t("ডেলিভারি", "Delivery")}</p>
                  <p className="mt-1 text-[13px] font-medium">{form.customer_name} · {form.phone}</p>
                  <p className="mt-0.5 text-[12.5px] text-sand-100/60">
                    {form.division} · {form.district} · {form.upazila}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-sand-100/60">{form.address}</p>
                </div>

                {/* payment recap */}
                <div className="rounded-xl border border-white/10 p-3.5">
                  <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">{t("পেমেন্ট", "Payment")}</p>
                  <div className="mt-1 flex items-center gap-2.5">
                    <CreditCard className="h-4 w-4 text-leaf-300" />
                    <p className="text-[13px] font-medium">{selectedMethod?.name_bn}</p>
                  </div>
                </div>

                {/* items */}
                <div className="rounded-xl border border-white/10 p-3.5">
                  <p className="mb-2 text-[10.5px] uppercase tracking-wider text-sand-100/40">
                    {t("পণ্য", "Items")} ({cart.items.length})
                  </p>
                  <ul className="space-y-1.5">
                    {cart.items.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                        <span className="min-w-0 truncate text-sand-100/75">
                          {isBn ? l.nameBn : l.nameEn} <span className="text-sand-100/40">× {l.quantity}</span>
                        </span>
                        <span className="shrink-0 font-medium">{money(l.price * l.quantity, isBn)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={submitting}
                  className="btn-primary w-full !py-3.5 text-[15px]"
                >
                  {submitting ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      {t("অর্ডার দেওয়া হচ্ছে…", "Placing order…")}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      {t(`আর্ডার দিন — ${money(total, isBn)}`, `Place order — ${money(total, isBn)}`)}
                    </>
                  )}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-sand-100/40">
                  <ShieldCheck className="h-3 w-3 text-leaf-400" />
                  {t("অর্ডার দেওয়ার পর পেমেন্ট নির্দেশনা দেখতে পাবেন", "You'll see payment instructions after placing the order")}
                </p>
              </div>
            </section>
          ) : null}
        </div>

        {/* ── RIGHT: order summary ───────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <Truck className="h-4 w-4 text-leaf-300" />
                {t("অর্ডার সারসংক্ষেপ", "Order summary")}
              </h2>
            </div>
            <div className="space-y-2.5 p-5">
              <div className="flex justify-between text-[12.5px]">
                <span className="text-sand-100/50">{t("সাবটোটাল", "Subtotal")}</span>
                <span className="font-medium">{money(cart.subtotal, isBn)}</span>
              </div>
              <div className="flex justify-between text-[12.5px]">
                <span className="text-sand-100/50">{t("ডেলিভারি", "Delivery")}</span>
                <span className="font-medium">
                  {delivery === 0 ? t("ফ্রি", "Free") : money(delivery, isBn)}
                </span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-[12.5px] text-leaf-300">
                  <span>{t("ছাড়", "Discount")}</span>
                  <span>−{money(discount, isBn)}</span>
                </div>
              ) : null}
              {freeDelivery ? (
                <p className="rounded-lg bg-leaf-600/10 px-2.5 py-1.5 text-[11px] font-semibold text-leaf-200">
                  {t("ফ্রি ডেলিভারি পেয়েছেন", "You got free delivery")}
                </p>
              ) : null}
              <div className="flex justify-between border-t border-white/[0.06] pt-3 text-[15px] font-bold">
                <span>{t("মোট", "Total")}</span>
                <span className="text-leaf-200">{money(total, isBn)}</span>
              </div>
            </div>
          </div>

          <div className="card mt-4 p-4">
            <p className="flex items-center gap-1.5 text-[11.5px] text-sand-100/50">
              <ShieldCheck className="h-3.5 w-3.5 text-leaf-400" />
              {t("১০০% নিরাপদ · ক্যাশ অন ডেলিভারি সুবিধা আছে", "100% secure · cash on delivery available")}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
      </div>
    </div>
  );
}
