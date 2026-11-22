"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Lock, Tag, Truck } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";
import { divisions, districtsOf, upazilasOf, dhakaMetroThanas } from "@/lib/bd-locations";
import { orderStatusSteps } from "@/lib/site";
import type { PublicPaymentMethod } from "@/lib/types";
import { EmptyState, Spinner } from "@/components/ui";



type Step = 1 | 2 | 3;

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
  // Default to cash on delivery when it exists, otherwise the first enabled
  // method — never a hard-coded id, because the owner can disable any of them.
  const [payment, setPayment] = useState<string>(
    methods.find((m) => m.code === "cod")?.code ?? methods[0]?.code ?? ""
  );
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const districtList = useMemo(() => (form.division ? districtsOf(form.division) : []), [form.division]);
  const upazilaList = useMemo(
    () => (form.division && form.district ? upazilasOf(form.division, form.district) : []),
    [form.division, form.district]
  );

  const isInsideDhaka = form.division === "ঢাকা" && dhakaMetroThanas.has(form.upazila);
  const baseDelivery = isInsideDhaka ? 60 : form.district ? 120 : 0;
  const freeDelivery = cart.subtotal >= 1200;
  const delivery = cart.items.some((l) => l.kind === "combo") ? 0 : freeDelivery ? 0 : baseDelivery;
  const total = Math.max(0, cart.subtotal + delivery - discount);

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
          items: cart.items.map((l) => ({ id: l.id, kind: l.kind, quantity: l.quantity })),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        throw new Error(json.message ?? "অর্ডার সম্পন্ন হয়নি");
      }

      const { order_no } = json.data;

      cart.clear();

      // COD needs no proof of payment; every other method goes to the manual
      // flow where the customer submits the TrxID for admin verification.
      if (payment === "cod") {
        window.location.href = `/order-success?order=${order_no}`;
      } else {
        window.location.href = `/payment/manual?order=${order_no}&method=${encodeURIComponent(payment)}`;
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

  return (
    <div className="container-x py-7 sm:py-10">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold sm:text-3xl">{t("চেকআউট", "Checkout")}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-sand-100/45">
          <Lock className="h-3.5 w-3.5 text-leaf-400" />
          {t("আপনার তথ্য নিরাপদে সংরক্ষিত", "Your information is securely stored")}
        </p>
      </div>

      {/* step indicator */}
      <ol className="mb-6 flex items-center gap-2 text-[11.5px]">
        {[
          { n: 1, label: t("ঠিকানা", "Address") },
          { n: 2, label: t("পেমেন্ট", "Payment") },
          { n: 3, label: t("নিশ্চিতকরণ", "Confirm") },
        ].map((s, i) => (
          <li key={s.n} className="flex flex-1 items-center gap-2">
            <button
              onClick={() => setStep(s.n as Step)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-semibold transition ${
                step >= s.n ? "bg-leaf-600/20 text-leaf-200" : "text-sand-100/40"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                  step > s.n ? "bg-leaf-500 text-ink-900" : step === s.n ? "bg-leaf-500 text-ink-900" : "bg-white/10"
                }`}
              >
                {step > s.n ? <Check className="h-3 w-3" /> : s.n}
              </span>
              {s.label}
            </button>
            {i < 2 ? <span className={`h-px flex-1 ${step > s.n ? "bg-leaf-500/50" : "bg-white/10"}`} /> : null}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          {/* ── STEP 1: address */}
          <section className={`card p-5 ${step !== 1 ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-leaf-600/20 text-[11px] text-leaf-200">১</span>
                {t("ডেলিভারি ঠিকানা", "Delivery address")}
              </h2>
              {step !== 1 ? (
                <button onClick={() => setStep(1)} className="text-[12px] font-semibold text-leaf-300">
                  {t("পরিবর্তন", "Edit")}
                </button>
              ) : null}
            </div>

            {step === 1 ? (
              <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
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
                    {Object.keys(divisions).map((d) => (
                      <option key={d} value={d} className="bg-ink-800">{d}</option>
                    ))}
                  </select>
                  {errors.division ? <p className="mt-1 text-[11px] text-red-300">{errors.division}</p> : null}
                </label>

                <label>
                  <span className="label">{t("জেলা", "District")} *</span>
                  <select
                    value={form.district}
                    disabled={!form.division}
                    onChange={(e) => {
                      update("district", e.target.value);
                      update("upazila", "");
                    }}
                    className="input disabled:opacity-40"
                  >
                    <option value="">{t("নির্বাচন করুন", "Select")}</option>
                    {districtList.map((d) => (
                      <option key={d} value={d} className="bg-ink-800">{d}</option>
                    ))}
                  </select>
                  {errors.district ? <p className="mt-1 text-[11px] text-red-300">{errors.district}</p> : null}
                </label>

                <label>
                  <span className="label">{t("উপজেলা / থানা", "Upazila / Thana")} *</span>
                  <select
                    value={form.upazila}
                    disabled={!form.district}
                    onChange={(e) => update("upazila", e.target.value)}
                    className="input disabled:opacity-40"
                  >
                    <option value="">{t("নির্বাচন করুন", "Select")}</option>
                    {upazilaList.map((u) => (
                      <option key={u} value={u} className="bg-ink-800">{u}</option>
                    ))}
                  </select>
                  {errors.upazila ? <p className="mt-1 text-[11px] text-red-300">{errors.upazila}</p> : null}
                </label>

                <label className="sm:col-span-2">
                  <span className="label">{t("সম্পূর্ণ ঠিকানা", "Full address")} *</span>
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    className="input resize-none"
                    placeholder={t("বাসা / রোড / এলাকা / ল্যান্ডমার্ক", "House / Road / Area / Landmark")}
                    autoComplete="street-address"
                  />
                  {errors.address ? <p className="mt-1 text-[11px] text-red-300">{errors.address}</p> : null}
                </label>

                <label className="sm:col-span-2">
                  <span className="label">{t("ডেলিভারি নোট (ঐচ্ছিক)", "Delivery note (optional)")}</span>
                  <input
                    value={form.delivery_note}
                    onChange={(e) => update("delivery_note", e.target.value)}
                    className="input"
                    placeholder={t("যেমন: বিকেল ৫টার পরে ডেলিভারি দিন", "e.g. deliver after 5 PM")}
                    maxLength={300}
                  />
                </label>

                {form.upazila ? (
                  <p className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-leaf-600/10 px-3 py-2 text-[11.5px] text-leaf-200">
                    <Truck className="h-3.5 w-3.5" />
                    {isInsideDhaka
                      ? t("ঢাকা সিটির ভেতরে — আজই ডেলিভারি সম্ভব (সকাল ১০টার আগে অর্ডারে)", "Inside Dhaka city — same-day delivery available")
                      : t("ঢাকার বাইরে — ২–৩ কর্মদিবসে ডেলিভারি", "Outside Dhaka — 2–3 working days")}
                  </p>
                ) : null}

                <div className="sm:col-span-2">
                  <button
                    onClick={() => {
                      if (validateStep1()) setStep(2);
                    }}
                    className="btn-primary w-full"
                  >
                    {t("পেমেন্টে এগিয়ে যান", "Continue to payment")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] leading-relaxed text-sand-100/60">
                {form.customer_name} · {form.phone}
                <br />
                {form.address}, {form.upazila}, {form.district}, {form.division}
              </p>
            )}
          </section>

          {/* ── STEP 2: payment */}
          <section className={`card p-5 ${step < 2 ? "hidden" : ""}`}>
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-leaf-600/20 text-[11px] text-leaf-200">২</span>
              {t("পেমেন্ট পদ্ধতি", "Payment method")}
            </h2>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPayment(m.code)}
                  aria-pressed={payment === m.code}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                    payment === m.code
                      ? "border-leaf-500/70 bg-leaf-600/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  {m.logo_url ? (
                    <span className="relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                      <Image src={m.logo_url} alt="" fill sizes="28px" className="object-contain p-0.5" />
                    </span>
                  ) : (
                    <span className="text-lg" aria-hidden>
                      {m.kind === "cod" ? "💵" : m.kind === "bank" ? "🏦" : "📱"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">{m.name_bn}</span>
                    <span className="block text-[10.5px] leading-relaxed text-sand-100/45">
                      {m.kind === "cod"
                        ? t("পণ্য হাতে পেয়ে টাকা দিন", "Pay when the order arrives")
                        : t(
                            `Send Money · ${m.account_number ?? ""}`,
                            `Send Money · ${m.account_number ?? ""}`
                          )}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                      payment === m.code ? "border-leaf-400 bg-leaf-500" : "border-white/25"
                    }`}
                  >
                    {payment === m.code ? <Check className="h-2.5 w-2.5 text-ink-900" /> : null}
                  </span>
                </button>
              ))}
            </div>

            {payment !== "cod" ? (
              <p className="mt-3 rounded-xl bg-sky-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-sky-200/90">
                ℹ️ {t(
                  "অর্ডার করার পর আপনি যে নম্বরে Send Money করবেন, খোলা পেজে সেই নম্বর ও TrxID দেওয়ার ফর্ম পাবেন। আমাদের টিম যাচাই করে অনুমোদন দিলে অর্ডার নিশ্চিত হবে।",
                  "After placing the order you'll see the receiving number, send the money, and submit the TrxID. We verify it before the order is confirmed."
                )}
              </p>
            ) : null}

            <button onClick={() => setStep(3)} className="btn-primary mt-4 w-full">
              {t("সারাংশ দেখুন", "Review order")}
            </button>
          </section>

          {/* ── STEP 3: confirm */}
          {step >= 3 ? (
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-leaf-600/20 text-[11px] text-leaf-200">৩</span>
                {t("অর্ডার নিশ্চিত করুন", "Confirm your order")}
              </h2>

              <div className="mt-4 space-y-2">
                {cart.items.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-2">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                      {l.image ? <Image src={l.image} alt="" fill sizes="48px" className="object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">{t(l.nameBn, l.nameEn)}</p>
                      <p className="text-[11px] text-sand-100/45">
                        {l.quantity} × {money(l.price, isBn)}
                      </p>
                    </div>
                    <p className="text-[12.5px] font-semibold text-leaf-200">{money(l.price * l.quantity, isBn)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.07] p-3 text-[12px] text-sand-100/60">
                <p className="font-semibold text-sand-100">{t("পেমেন্ট", "Payment")}</p>
                <p className="mt-0.5">
                  {methods.find((m) => m.code === payment)?.name_bn ?? ""}
                </p>
              </div>

              <button onClick={placeOrder} disabled={submitting} className="btn-mint mt-4 w-full !py-3.5 text-[15px]">
                {submitting ? <Spinner /> : <Lock className="h-4 w-4" />}
                {t(`অর্ডার কনফার্ম করুন — ${money(total, isBn)}`, `Place order — ${money(total, false)}`)}
              </button>
              <p className="mt-2 text-center text-[10.5px] leading-relaxed text-sand-100/35">
                {t("অর্ডার করলে আপনি আমাদের শর্তাবলী মেনে নিচ্ছেন।", "By ordering you agree to our terms.")}
              </p>
            </section>
          ) : null}
        </div>

        {/* ── summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="text-[15px] font-bold">{t("অর্ডার সারাংশ", "Order summary")}</h2>

            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {cart.items.map((l) => (
                <li key={l.id} className="flex items-center gap-2.5">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                    {l.image ? <Image src={l.image} alt="" fill sizes="40px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px]">{t(l.nameBn, l.nameEn)}</p>
                    <p className="text-[10.5px] text-sand-100/40">{l.quantity} × {money(l.price, isBn)}</p>
                  </div>
                  <p className="text-[12px] font-semibold">{money(l.price * l.quantity, isBn)}</p>
                </li>
              ))}
            </ul>

            {/* coupon */}
            <div className="mt-4">
              <div className="flex gap-2">
                <label className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sand-100/35" />
                  <input
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    placeholder={t("কুপন কোড", "Coupon code")}
                    className="input !rounded-xl !py-2.5 !pl-9 text-[12px] uppercase"
                  />
                </label>
                <button onClick={applyCoupon} disabled={couponLoading} className="btn-ghost btn-sm !rounded-xl">
                  {couponLoading ? <Spinner /> : t("প্রয়োগ", "Apply")}
                </button>
              </div>
              {appliedCoupon ? (
                <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-leaf-300">
                  <Check className="h-3 w-3" /> {appliedCoupon} {t("প্রয়োগ হয়েছে", "applied")} (−{money(discount, isBn)})
                </p>
              ) : (
                <p className="mt-1.5 text-[10.5px] text-sand-100/35">
                  {t("ট্রাই করুন: BISWAS10", "Try: BISWAS10")}
                </p>
              )}
            </div>

            <dl className="mt-4 space-y-2 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-sand-100/55">{t("সাবটোটাল", "Subtotal")}</dt>
                <dd className="font-medium">{money(cart.subtotal, isBn)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sand-100/55">{t("ডেলিভারি", "Delivery")}</dt>
                <dd className="font-medium">
                  {delivery === 0 ? <span className="text-leaf-300">{t("ফ্রি", "Free")}</span> : money(delivery, isBn)}
                </dd>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-leaf-300">
                  <dt>{t("ছাড়", "Discount")}</dt>
                  <dd className="font-medium">−{money(discount, isBn)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="my-3 divider" />

            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">{t("সর্বমোট", "Total")}</span>
              <span className="text-2xl font-bold text-leaf-200">{money(total, isBn)}</span>
            </div>

            <div className="mt-4 rounded-xl bg-white/[0.03] p-3">
              <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-sand-100/40">
                {t("অর্ডার প্রক্রিয়া", "Order flow")}
              </p>
              <ol className="flex items-center justify-between gap-1">
                {orderStatusSteps.map((s, i) => (
                  <li key={s.key} className="flex flex-1 flex-col items-center gap-1 text-center">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-leaf-600/15 text-[10px]">{s.icon}</span>
                    <span className="text-[9px] leading-tight text-sand-100/45">{s.bn}</span>
                    {i < orderStatusSteps.length - 1 ? <span className="sr-only">→</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="container-x py-10">
      <div className="skeleton h-8 w-40" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <div className="skeleton h-64 rounded-3xl" />
          <div className="skeleton h-40 rounded-3xl" />
        </div>
        <div className="skeleton h-80 rounded-3xl" />
      </div>
    </div>
  );
}
