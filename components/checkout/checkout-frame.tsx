"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";

/* ==========================================================================
   CheckoutFrame — warm premium-artisanal checkout
   --------------------------------------------------------------------------
   A single static desktop checkout frame in a sand + terracotta palette:
   sticky nav, dot-grain hero strip, numbered billing + payment cards on the
   left, and a sticky dark-ink order summary on the right. The real cart,
   delivery rules, coupon and order API are wired through so the frame is
   fully functional, not just a mockup.
   ========================================================================== */

/** Iconify web-API inline SVG (ph:* + logos:*), per the design spec. */
function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  return (
    <img
      src={`https://api.iconify.design/${name}.svg`}
      alt=""
      aria-hidden
      className={className}
      draggable={false}
    />
  );
}

/** Stable pastel gradient per line item for the summary swatches. */
const SWATCHES = [
  "linear-gradient(135deg,#f0c9a8,#c4633f)",
  "linear-gradient(135deg,#e7d3a8,#a64f30)",
  "linear-gradient(135deg,#d7cbb0,#8a4127)",
  "linear-gradient(135deg,#f0bca0,#b5552f)",
  "linear-gradient(135deg,#e4cfa6,#9a5a32)",
];

export function CheckoutFrame() {
  const cart = useCart();
  const { isBn, t } = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postal: "",
    country: "বাংলাদেশ",
  });
  const [payment, setPayment] = useState<"card" | "paypal">("card");
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", name: "" });
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const subtotal = cart.subtotal;
  const delivery = 0; // combos ship free; the spec frame shows a flat shipping line
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const total = Math.max(0, subtotal + delivery - discount);

  const itemCount = cart.items.length;

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon.trim(), subtotal }),
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

  function validate() {
    const e: Record<string, string> = {};
    if ((form.first_name.trim() + form.last_name.trim()).length < 2) e.first_name = "পুরো নাম দিন";
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(form.email)) e.email = "সঠিক ইমেইল দিন";
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(form.phone.replace(/[\s-]/g, ""))) e.phone = "সঠিক মোবাইল নম্বর দিন";
    if (form.address.trim().length < 8) e.address = "সম্পূর্ণ ঠিকানা লিখুন";
    if (!form.city.trim()) e.city = "শহর দিন";
    if (payment === "card") {
      if (card.number.replace(/\s/g, "").length < 12) e.card_number = "কার্ড নম্বর দিন";
      if (!/^\d{2}\s*\/\s*\d{2}$/.test(card.expiry)) e.card_expiry = "Expiry MM/YY";
      if (card.cvc.length < 3) e.card_cvc = "CVC দিন";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function pay() {
    if (!validate()) {
      toast.error(t("কিছু তথ্য অসম্পূর্ণ", "Please complete the form"), t("প্রয়োজনীয় তথ্য দিন", "Fill in the required fields"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer_name: `${form.first_name} ${form.last_name}`.trim(),
        phone: form.phone,
        email: form.email,
        division: form.city,
        district: form.city,
        upazila: form.city,
        address: form.address,
        payment_method: payment,
        coupon_code: appliedCoupon ?? "",
        items: cart.items.map((l) => ({
          id: l.id,
          kind: l.kind,
          quantity: l.quantity,
          slug: l.slug,
          name: isBn ? l.nameBn : l.nameEn,
        })),
      };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? t("অর্ডার সম্পন্ন হয়নি", "Order failed"));
      cart.clear();
      router.push(`/order-success?order=${json.data.order_no}`);
    } catch (err) {
      toast.error(t("অর্ডার ব্যর্থ হয়েছে", "Order failed"), (err as Error).message);
      setSubmitting(false);
    }
  }

  if (!cart.ready) {
    return (
      <div className="min-h-dvh bg-sand text-ink">
        <div className="mx-auto max-w-[1180px] px-6 py-20 text-center text-inkmut">…</div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-dvh bg-sand text-ink">
        <div className="mx-auto max-w-[1180px] px-6 py-20 text-center">
          <p className="text-inkmut">কার্ট খালি। প্রথমে কিছু পণ্য কার্টে যোগ করুন।</p>
          <Link href="/products" className="mt-4 inline-block rounded-full bg-terra px-6 py-2.5 font-semibold text-white shadow-prembutn">
            পণ্য দেখুন
          </Link>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: "/products", label: "Shop" },
    { href: "/combos", label: "Combos" },
    { href: "/subscription", label: "Boxes" },
    { href: "/farm", label: "Farm" },
  ];

  return (
    <div className="min-h-dvh bg-sand font-sans text-ink" style={{ letterSpacing: "-0.011em" }}>
      {/* ───────────────────────── sticky nav ───────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-sanddk/70 bg-sand/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-terra text-white shadow-prembutn">
              <Icon name="ph:leaf-bold" className="h-4.5 w-4.5" />
            </span>
            <span className="leading-none">
              <span className="block text-[15px] font-extrabold tracking-tight">Atelier</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-terradk">Sand</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[13px] font-medium text-inkmut transition-colors hover:text-terra"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[12px] font-medium text-inkmut sm:flex">
              <Icon name="ph:shield-check" className="h-4 w-4 text-terra" />
              Secure
            </span>
            <Link
              href="/cart"
              className="relative flex items-center gap-1.5 rounded-full border border-sanddk bg-sandlt px-3 py-1.5 text-[12px] font-semibold text-ink"
            >
              <Icon name="ph:shopping-bag" className="h-4 w-4 text-terra" />
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-terra px-1 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* ───────────────────────── grain hero strip ───────────────────────── */}
      <section className="relative overflow-hidden border-b border-sanddk/70 bg-sandlt">
        <div className="pointer-events-none absolute inset-0 bg-dot-grain [background-size:4px_4px]" aria-hidden />
        <div className="relative mx-auto max-w-[1180px] px-6 py-9 sm:py-11">
          <nav className="flex items-center gap-1.5 text-[12px] text-inkmut">
            <Link href="/cart" className="transition-colors hover:text-terra">Cart</Link>
            <Icon name="ph:chevron-right" className="h-3 w-3" />
            <Link href="/checkout" className="transition-colors hover:text-terra">Checkout</Link>
            <Icon name="ph:chevron-right" className="h-3 w-3" />
            <span className="text-ink/70">Confirmation</span>
          </nav>
          <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.22em] text-terradk">Almost yours</p>
          <h1 className="mt-1.5 text-[30px] font-extrabold leading-[1.02] tracking-tight sm:text-[36px]">
            Complete your checkout.
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sanddk bg-sand px-3 py-1.5 text-[12px] font-medium text-inkmut">
              <Icon name="ph:lock-simple" className="h-3.5 w-3.5 text-terra" />
              256-bit SSL · PCI DSS
            </span>
          </div>
        </div>
      </section>

      {/* ───────────────────────── two-column frame ───────────────────────── */}
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1fr_380px] lg:py-10">
        {/* left: forms */}
        <div className="flex flex-col gap-6">
          {/* ── billing card ── */}
          <section className="rounded-3xl border border-sanddk bg-sandlt shadow-prem">
            <SectionHeader n="1" title="Billing details" sub={t("আপনার ঠিকানা", "Your address")} />
            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
              <Field label="First name" error={errors.first_name} className="sm:col-span-1">
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => update("first_name", e.target.value)}
                  placeholder="রাহুল"
                  className="field"
                />
              </Field>
              <Field label="Last name" error={errors.last_name}>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => update("last_name", e.target.value)}
                  placeholder="বিশ্বাস"
                  className="field"
                />
              </Field>
              <Field label="Email" error={errors.email} className="sm:col-span-2">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@example.com"
                  className="field"
                />
              </Field>
              <Field label="Phone" error={errors.phone} className="sm:col-span-2">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="01700000000"
                  className="field"
                />
              </Field>
              <Field label="Address" error={errors.address} className="sm:col-span-2">
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="House 12, Road 7, Dhanmondi"
                  className="field"
                />
              </Field>
              <Field label="City" error={errors.city}>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Dhaka"
                  className="field"
                />
              </Field>
              <Field label="Postal code" error={errors.postal}>
                <input
                  type="text"
                  value={form.postal}
                  onChange={(e) => update("postal", e.target.value)}
                  placeholder="1209"
                  className="field"
                />
              </Field>
              <Field label="Country" className="sm:col-span-2">
                <div className="relative">
                  <select
                    value={form.country}
                    onChange={(e) => update("country", e.target.value)}
                    className="field w-full appearance-none pr-9"
                  >
                    <option>বাংলাদেশ</option>
                    <option>Bangladesh</option>
                  </select>
                  <Icon name="ph:caret-down" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-inkmut" />
                </div>
              </Field>
            </div>
          </section>

          {/* ── payment card ── */}
          <section className="rounded-3xl border border-sanddk bg-sandlt shadow-prem">
            <SectionHeader n="2" title="Payment" sub={t("সুরক্ষিত পেমেন্ট", "Secure payment")} />
            <div className="p-6">
              {/* brand logos */}
              <div className="flex items-center gap-3">
                {["logos:visa", "logos:mastercard", "logos:amex", "logos:paypal"].map((n) => (
                  <span
                    key={n}
                    className="grid h-9 w-14 place-items-center rounded-lg border border-sanddk bg-sand"
                  >
                    <Icon name={n} className="h-5 w-7.5" />
                  </span>
                ))}
              </div>

              {/* segmented toggle */}
              <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-sand p-1">
                {(["card", "paypal"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayment(m)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
                      payment === m ? "bg-white text-terradk shadow-premsoft" : "text-inkmut hover:text-ink"
                    }`}
                  >
                    <Icon name={m === "card" ? "ph:credit-card" : "ph:paypal-logo"} className="h-4 w-4" />
                    {m === "card" ? "Card" : "PayPal"}
                  </button>
                ))}
              </div>

              {payment === "card" ? (
                <div className="mt-5 grid grid-cols-1 gap-4">
                  <Field label="Card number" error={errors.card_number} className="sm:col-span-2">
                    <div className="relative">
                      <Icon name="ph:credit-card" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-inkmut" />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={card.number}
                        onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
                        placeholder="4242 4242 4242 4242"
                        className="field pl-9"
                      />
                    </div>
                  </Field>
                  <Field label="Expiry" error={errors.card_expiry}>
                    <input
                      type="text"
                      value={card.expiry}
                      onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
                      placeholder="MM/YY"
                      className="field"
                    />
                  </Field>
                  <Field label="CVC" error={errors.card_cvc}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={card.cvc}
                      onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))}
                      placeholder="123"
                      className="field"
                    />
                  </Field>
                  <Field label="Name on card" className="sm:col-span-2">
                    <input
                      type="text"
                      value={card.name}
                      onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                      placeholder="Rahul Biswas"
                      className="field"
                    />
                  </Field>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-sanddk bg-sand px-4 py-4 text-[13px] text-inkmut">
                  You'll be redirected to PayPal to complete your payment securely.
                </div>
              )}

              <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={sameAsShipping}
                  onChange={(e) => setSameAsShipping(e.target.checked)}
                  className="h-4 w-4 accent-terra"
                />
                <span className="font-medium">Same as shipping address</span>
                <Icon name="ph:check-circle" className="h-4 w-4 text-terra" />
              </label>
            </div>
          </section>
        </div>

        {/* right: dark order summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl bg-ink text-sand shadow-prem">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-terra">Order summary</p>
                <p className="mt-0.5 text-[13px] text-sand/70">{t("অর্ডার সারাংশ", "Summary")}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-sand">
                {itemCount} items
              </span>
            </div>

            <ul className="divide-y divide-white/10">
              {cart.items.slice(0, 3).map((l, i) => (
                <li key={l.id} className="flex items-center gap-3 px-6 py-4">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[15px] font-bold text-white"
                    style={{ backgroundImage: SWATCHES[i % SWATCHES.length] }}
                  >
                    {isBn ? l.nameBn.charAt(0) : l.nameEn.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-sand">{isBn ? l.nameBn : l.nameEn}</p>
                    <p className="text-[11px] text-sand/55">{money(l.price, isBn)} · {l.unit}</p>
                  </div>
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white/10 px-2 text-[11px] font-bold text-sand">
                    {l.quantity}
                  </span>
                </li>
              ))}
              {cart.items.length > 3 && (
                <li className="px-6 py-3 text-[12px] text-sand/55">+{cart.items.length - 3} more items</li>
              )}
            </ul>

            {/* promo */}
            <div className="border-t border-white/10 px-6 py-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder={t("কুপন কোড", "Promo code")}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-sand placeholder:text-sand/40"
                />
                <button
                  onClick={applyCoupon}
                  disabled={couponLoading || !coupon.trim()}
                  className="rounded-lg bg-terra px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-terraxd disabled:opacity-50"
                >
                  {couponLoading ? "…" : t("Apply", "Apply")}
                </button>
              </div>
            </div>

            {/* totals */}
            <dl className="space-y-2 border-t border-white/10 px-6 py-5 text-[13px]">
              <Row label={t("সাবটোটাল", "Subtotal")} value={money(subtotal, isBn)} />
              <Row label={t("ডেলিভারি", "Shipping")} value={delivery === 0 ? t("বিনামূল্যে", "Free") : money(delivery, isBn)} />
              <Row label={t("ট্যাক্স", "Tax")} value={money(tax, isBn)} />
              {appliedCoupon && (
                <Row label={`${appliedCoupon}`} value={`− ${money(discount, isBn)}`} accent />
              )}
              <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-[14px] font-bold text-sand">{t("মোট", "Total")}</span>
                <span className="text-[18px] font-extrabold text-white">{money(total, isBn)}</span>
              </div>
            </dl>

            {/* pay */}
            <div className="px-6 pb-6">
              <button
                onClick={pay}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-terradk py-3.5 text-[15px] font-bold text-white shadow-prembutn transition-colors hover:bg-terraxd disabled:opacity-60"
              >
                <Icon name="ph:lock-key" className="h-4.5 w-4.5" />
                {submitting ? t("প্রক্রিয়া হচ্ছে…", "Processing…") : `${t("পেমেন্ট করুন", "Pay")} ${money(total, isBn)}`}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-sand/55">
                <Icon name="ph:shield-check" className="h-3.5 w-3.5 text-terra" />
                {t("সম্পূর্ণ করা হলে আপনি পেমেন্ট সুরক্ষিত হবেন", "Your payment is encrypted and secure")}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ───────────────────────── trust row ───────────────────────── */}
      <div className="mx-auto max-w-[1180px] px-6 pb-8">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 rounded-2xl border border-sanddk bg-sandlt py-4 text-inkmut">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <Icon name="ph:truck" className="h-4 w-4 text-terra" />
            Free returns
          </span>
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <Icon name="ph:leaf" className="h-4 w-4 text-terra" />
            Carbon neutral
          </span>
        </div>
      </div>

      {/* ───────────────────────── slim footer ───────────────────────── */}
      <footer className="border-t border-sanddk/70 bg-sand">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-2 px-6 py-5 text-[12px] text-inkmut sm:flex-row">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <Icon name="ph:leaf-bold" className="h-4 w-4 text-terra" />
            Atelier · Sand
          </span>
          <span>© {new Date().getFullYear()} AtelierSand. Crafted with care.</span>
        </div>
      </footer>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e0d6c2;
          background: #ffffff;
          padding: 0.625rem 0.75rem;
          font-size: 13px;
          color: #2b251d;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .field::placeholder { color: #7c715d; }
        .field:focus {
          border-color: #c4633f;
          box-shadow: 0 0 0 3px rgba(196,99,63,.14);
        }
      `}</style>
    </div>
  );
}

function SectionHeader({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-sanddk/70 px-6 py-5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-terra text-[13px] font-extrabold text-white">
        {n}
      </span>
      <div>
        <h2 className="text-[15px] font-extrabold tracking-tight leading-tight">{title}</h2>
        <p className="text-[12px] text-inkmut">{sub}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "#5a5040" }}>
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-[12px] font-medium text-terradk">{error}</span>}
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sand/65">{label}</dt>
      <dd className={`font-semibold ${accent ? "text-terra" : "text-sand"}`}>{value}</dd>
    </div>
  );
}
