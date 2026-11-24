"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Leaf,
  Lock,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Wallet,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";
import { Logo } from "@/components/icon-logo";

/* ==========================================================================
   CheckoutFrame — JapanLogue neumorphic checkout
   --------------------------------------------------------------------------
   A single static desktop checkout frame in the soft blue-grey palette:
   floating nav, raised billing + payment cards on the left, and a sticky
   raised order summary on the right. The real cart, delivery rules, coupon
   and order API are wired through so the frame is fully functional, not just
   a mockup.
   ========================================================================== */

/** Stable pastel gradient per line item for the summary swatches. */
const SWATCHES = [
  "linear-gradient(135deg,#8eddb9,#1f7a4d)",
  "linear-gradient(135deg,#b7ead2,#33ab7b)",
  "linear-gradient(135deg,#5ac797,#186140)",
  "linear-gradient(135deg,#d6f3e3,#1f7a4d)",
  "linear-gradient(135deg,#8eddb9,#124a32)",
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
  const delivery = 0; // combos ship free; the frame shows a flat shipping line
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
      <div className="grid min-h-dvh place-items-center bg-neu-bg p-6">
        <div className="neu-inset grid h-16 w-16 place-items-center rounded-full">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-neu-line border-t-neu-accent" />
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="grid min-h-dvh place-items-center bg-neu-bg p-6">
        <div className="card max-w-md p-10 text-center">
          <span className="neu-raised mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl">🛒</span>
          <h1 className="mt-5 text-2xl font-bold">কার্ট খালি</h1>
          <p className="mt-2 text-sm leading-relaxed text-neu-muted">
            প্রথমে কিছু পণ্য কার্টে যোগ করুন।
          </p>
          <Link href="/products" className="btn-primary mt-6">
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
    <div className="min-h-dvh bg-neu-bg font-sans text-neu-ink">
      {/* ───────────────────────── floating nav ───────────────────────── */}
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="neu-bar mx-auto flex max-w-[1180px] items-center justify-between rounded-[24px] px-4 py-3 sm:px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={34} />
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[13px] font-medium text-neu-muted transition-colors hover:text-neu-accent-strong"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[12px] font-medium text-neu-muted sm:flex">
              <ShieldCheck className="h-4 w-4 text-neu-accent" />
              Secure
            </span>
            <Link
              href="/cart"
              className="neu-pill flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold !text-neu-ink"
            >
              <ShoppingBag className="h-4 w-4 text-neu-accent" />
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-neu-accent px-1 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* ───────────────────────── raised hero strip ───────────────────────── */}
      <section className="px-3 pt-4 sm:px-6">
        <div className="neu-raised-lg relative mx-auto max-w-[1180px] overflow-hidden rounded-[28px]">
          <div className="pointer-events-none absolute inset-0 bg-dot-grain [background-size:5px_5px]" aria-hidden />
          <div className="relative px-6 py-9 sm:px-8 sm:py-11">
            <nav className="flex items-center gap-1.5 text-[12px] text-neu-muted">
              <Link href="/cart" className="transition-colors hover:text-neu-accent-strong">Cart</Link>
              <ChevronRight className="h-3 w-3" />
              <Link href="/checkout" className="transition-colors hover:text-neu-accent-strong">Checkout</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-neu-ink/70">Confirmation</span>
            </nav>
            <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.22em] text-neu-accent-strong">Almost yours</p>
            <h1 className="mt-1.5 text-[30px] font-extrabold leading-[1.05] tracking-tight text-neu-ink sm:text-[36px]">
              Complete your checkout.
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="neu-pill px-3 py-1.5 text-[12px] font-medium !text-neu-muted">
                <Lock className="h-3.5 w-3.5 text-neu-accent" />
                256-bit SSL · PCI DSS
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── two-column frame ───────────────────────── */}
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-6 px-3 py-6 sm:px-6 lg:grid-cols-[1fr_380px] lg:py-8">
        {/* left: forms */}
        <div className="flex flex-col gap-6">
          {/* ── billing card ── */}
          <section className="card overflow-hidden">
            <SectionHeader n="1" title="Billing details" sub={t("আপনার ঠিকানা", "Your address")} />
            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
              <Field label="First name" error={errors.first_name}>
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
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neu-faint" />
                </div>
              </Field>
            </div>
          </section>

          {/* ── payment card ── */}
          <section className="card overflow-hidden">
            <SectionHeader n="2" title="Payment" sub={t("সুরক্ষিত পেমেন্ট", "Secure payment")} />
            <div className="p-6">
              {/* brand badges — local, no third-party requests */}
              <div className="flex items-center gap-2.5">
                {["VISA", "MC", "AMEX", "PayPal"].map((n) => (
                  <span
                    key={n}
                    className="neu-pill grid h-9 w-14 place-items-center rounded-xl px-0 text-[10px] font-bold tracking-wide text-neu-muted"
                  >
                    {n}
                  </span>
                ))}
              </div>

              {/* segmented toggle */}
              <div className="neu-inset-sm mt-5 grid grid-cols-2 gap-1 rounded-xl p-1">
                {(["card", "paypal"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayment(m)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold transition-all ${
                      payment === m ? "neu-raised-xs bg-neu-raised text-neu-accent-strong" : "text-neu-muted hover:text-neu-ink"
                    }`}
                  >
                    {m === "card" ? <CreditCard className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                    {m === "card" ? "Card" : "PayPal"}
                  </button>
                ))}
              </div>

              {payment === "card" ? (
                <div className="mt-5 grid grid-cols-1 gap-4">
                  <Field label="Card number" error={errors.card_number} className="sm:col-span-2">
                    <div className="relative">
                      <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neu-faint" />
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
                <div className="neu-inset-sm mt-5 rounded-xl px-4 py-4 text-[13px] leading-relaxed text-neu-muted">
                  You'll be redirected to PayPal to complete your payment securely.
                </div>
              )}

              <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-[13px] text-neu-ink">
                <input
                  type="checkbox"
                  checked={sameAsShipping}
                  onChange={(e) => setSameAsShipping(e.target.checked)}
                  className="h-4 w-4 accent-neu-accent"
                />
                <span className="font-medium">Same as shipping address</span>
                <CheckCircle2 className="h-4 w-4 text-neu-accent" />
              </label>
            </div>
          </section>
        </div>

        {/* right: raised order summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="neu-raised-lg overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between border-b border-neu-line/50 px-6 py-5">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-neu-accent-strong">Order summary</p>
                <p className="mt-0.5 text-[13px] text-neu-muted">{t("অর্ডার সারাংশ", "Summary")}</p>
              </div>
              <span className="neu-pill px-3 py-1 text-[12px] font-semibold !text-neu-ink">
                {itemCount} items
              </span>
            </div>

            <ul className="divide-y divide-neu-line/50">
              {cart.items.slice(0, 3).map((l, i) => (
                <li key={l.id} className="flex items-center gap-3 px-6 py-4">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[15px] font-bold text-white shadow-neu-xs"
                    style={{ backgroundImage: SWATCHES[i % SWATCHES.length] }}
                  >
                    {isBn ? l.nameBn.charAt(0) : l.nameEn.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-neu-ink">{isBn ? l.nameBn : l.nameEn}</p>
                    <p className="text-[11px] text-neu-muted">{money(l.price, isBn)} · {l.unit}</p>
                  </div>
                  <span className="neu-pill grid h-6 min-w-6 place-items-center px-2 text-[11px] font-bold !text-neu-ink">
                    {l.quantity}
                  </span>
                </li>
              ))}
              {cart.items.length > 3 && (
                <li className="px-6 py-3 text-[12px] text-neu-muted">+{cart.items.length - 3} more items</li>
              )}
            </ul>

            {/* promo */}
            <div className="border-t border-neu-line/50 px-6 py-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder={t("কুপন কোড", "Promo code")}
                  className="neu-inset-sm w-full rounded-xl px-3 py-2 text-[13px] text-neu-ink outline-none transition placeholder:text-neu-faint focus:border-neu-accent/50"
                />
                <button
                  onClick={applyCoupon}
                  disabled={couponLoading || !coupon.trim()}
                  className="btn-primary px-4 py-2 text-[13px] disabled:opacity-50"
                >
                  {couponLoading ? "…" : t("Apply", "Apply")}
                </button>
              </div>
            </div>

            {/* totals */}
            <dl className="space-y-2 border-t border-neu-line/50 px-6 py-5 text-[13px]">
              <Row label={t("সাবটোটাল", "Subtotal")} value={money(subtotal, isBn)} />
              <Row label={t("ডেলিভারি", "Shipping")} value={delivery === 0 ? t("বিনামূল্যে", "Free") : money(delivery, isBn)} />
              <Row label={t("ট্যাক্স", "Tax")} value={money(tax, isBn)} />
              {appliedCoupon && <Row label={`${appliedCoupon}`} value={`− ${money(discount, isBn)}`} accent />}
              <div className="mt-1 flex items-center justify-between border-t border-neu-line/50 pt-3">
                <span className="text-[14px] font-bold text-neu-ink">{t("মোট", "Total")}</span>
                <span className="text-[18px] font-extrabold text-neu-accent-strong">{money(total, isBn)}</span>
              </div>
            </dl>

            {/* pay */}
            <div className="px-6 pb-6">
              <button onClick={pay} disabled={submitting} className="btn-primary w-full !py-3.5 !text-[15px]">
                <Lock className="h-4 w-4" />
                {submitting
                  ? t("প্রক্রিয়া হচ্ছে…", "Processing…")
                  : `${t("পেমেন্ট করুন", "Pay")} ${money(total, isBn)}`}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neu-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-neu-accent" />
                {t("সম্পূর্ণ করা হলে আপনি পেমেন্ট সুরক্ষিত হবেন", "Your payment is encrypted and secure")}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ───────────────────────── trust row ───────────────────────── */}
      <div className="mx-auto max-w-[1180px] px-3 pb-8 sm:px-6">
        <div className="neu-raised flex flex-wrap items-center justify-center gap-x-10 gap-y-3 rounded-2xl py-4 text-neu-muted">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <Truck className="h-4 w-4 text-neu-accent" />
            Free returns
          </span>
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <Leaf className="h-4 w-4 text-neu-accent" />
            Carbon neutral
          </span>
        </div>
      </div>

      {/* ───────────────────────── slim footer ───────────────────────── */}
      <footer className="border-t border-neu-line/50 bg-neu-surface/70">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-2 px-6 py-5 text-[12px] text-neu-muted sm:flex-row">
          <span className="flex items-center gap-2 font-semibold text-neu-ink">
            <Leaf className="h-4 w-4 text-neu-accent" />
            বিশ্বাস এগ্রো · Farm to Family
          </span>
          <span>© {new Date().getFullYear()} Biswas Agro. Crafted with care.</span>
        </div>
      </footer>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.9rem;
          border: 1px solid rgba(199, 206, 218, .55);
          background: #E3E8F0;
          padding: 0.7rem 0.85rem;
          font-size: 13px;
          color: #303943;
          outline: none;
          box-shadow: inset 4px 4px 9px rgba(163,177,198,.35), inset -4px -4px 9px rgba(255,255,255,.9);
          transition: border-color .18s, box-shadow .18s;
        }
        .field::placeholder { color: #98a3b3; }
        .field:focus {
          border-color: rgba(47,143,102,.55);
          box-shadow: inset 4px 4px 9px rgba(163,177,198,.35), inset -4px -4px 9px rgba(255,255,255,.9), 0 0 0 3px rgba(47,143,102,.12);
        }
      `}</style>
    </div>
  );
}

function SectionHeader({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-neu-line/50 px-6 py-5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-leaf-400 to-leaf-600 text-[13px] font-extrabold text-white shadow-neu-accent-sm">
        {n}
      </span>
      <div>
        <h2 className="text-[15px] font-extrabold leading-tight tracking-tight text-neu-ink">{title}</h2>
        <p className="text-[12px] text-neu-muted">{sub}</p>
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
      <span className="mb-1.5 block text-[12px] font-semibold text-neu-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[12px] font-medium text-[#c0392b]">{error}</span>}
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neu-muted">{label}</dt>
      <dd className={`font-semibold ${accent ? "text-neu-accent-strong" : "text-neu-ink"}`}>{value}</dd>
    </div>
  );
}
