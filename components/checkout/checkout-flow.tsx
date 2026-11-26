"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  BookmarkPlus,
  Check,
  ChevronRight,
  Clock,
  MessageCircle,
  Phone,
  CreditCard,
  Landmark,
  Lock,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Ticket,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useDeliveryConfig } from "@/lib/delivery-settings";
import { useLocale } from "@/lib/locale";
import { useStoreInfo } from "@/lib/store-info";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";
import { divisionNames, districtsOf, upazilasOf, dhakaMetroThanas } from "@/lib/bd-locations";
import type { Address, PublicPaymentMethod } from "@/lib/types";
import { Logo } from "@/components/icon-logo";
import { EmptyState, Spinner } from "@/components/ui";

/* ==========================================================================
   CheckoutFlow — the storefront checkout, on the same soft-UI system as the
   admin panel and on the same Supabase rows as /api/orders.
   --------------------------------------------------------------------------
   Step 1  delivery address (real BD division → district → upazila cascade)
   Step 2  payment method — the owner's active list from
           /foisal/payment-methods, with the receiving number + instructions
   Step 3  review and place the order

   Everything the page shows is real data: the cart, the delivery rules from
   `settings.delivery`, the admin-managed methods and the coupon API. The
   order payload matches `checkoutSchema` exactly, so a bKash order lands on
   /payment/bkash with the number the admin configured, and a COD order goes
   straight to /order-success.
   ========================================================================== */

type Step = 1 | 2 | 3 | 4;

/** Local icons only — the CSP blocks external assets and a device without an
 *  emoji font would otherwise show tofu where the method's mark should be. */
function MethodIcon({ code, className = "h-5 w-5" }: { code: string; className?: string }) {
  if (code === "cod") return <Banknote className={className} />;
  if (code === "bank" || code === "sslcommerz") return <Landmark className={className} />;
  return <Wallet className={className} />;
}

/** Only same-origin or Supabase-hosted logos can go through the image
 *  optimiser; anything else would be refused by `remotePatterns` (and by the
 *  strict CSP if loaded raw), so it falls back to the method's emoji. */
function canOptimize(src: string) {
  return src.startsWith("/") || /supabase\./i.test(src);
}

export function CheckoutFlow({
  methods: initialMethods,
  customer,
  addresses = [],
}: {
  methods: PublicPaymentMethod[];
  customer?: { full_name: string | null; phone: string | null; email: string | null } | null;
  addresses?: Address[];
}) {
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
          show_on_checkout: true,
        },
      ];

  const cart = useCart();
  const rules = useDeliveryConfig();
  const { t, isBn } = useLocale();
  const toast = useToast();
  const store = useStoreInfo();

  /* Prefill from the signed-in customer's profile and their default address —
     the same rows the admin sees on the customer record. */
  const defaultAddress = addresses.find((a) => a.is_default) ?? addresses[0];

  const [step, setStep] = useState<Step>(1);
  /* ── "save this address for next time" ────────────────────────────────────
     A customer who types a full address at checkout and then has to type it
     again next week is being asked the same question twice. The tick box
     default-ticks ONLY when the profile has no address yet — saving an extra
     copy of an address they already have would just clutter their list. */
  const [saveAddress, setSaveAddress] = useState(addresses.length === 0);
  /** The row we created during this checkout, so a second visit to step 1
      updates it instead of piling up duplicates. */
  const [savedAddressId, setSavedAddressId] = useState<string | null>(defaultAddress?.id ?? null);
  const [savingAddress, setSavingAddress] = useState(false);
  /** true once the row exists — the tick stays visible but short-circuits. */
  const [addressSaved, setAddressSaved] = useState(false);
  /* Step 4's checkbox: without it the last tap is a button that looks like the
     three before it, and the customer never had a moment where they explicitly
     said "yes, this one". */
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState(() => ({
    customer_name: customer?.full_name ?? defaultAddress?.full_name ?? "",
    phone: customer?.phone ?? defaultAddress?.phone ?? "",
    email: customer?.email ?? "",
    division: defaultAddress?.division ?? "",
    district: defaultAddress?.district ?? "",
    upazila: defaultAddress?.upazila ?? "",
    address: defaultAddress?.address ?? "",
    delivery_note: "",
  }));
  const [payment, setPayment] = useState<string>(
    methods.find((m) => m.code === "cod")?.code ?? methods[0]?.code ?? ""
  );
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  /* ── wallet (referral credit) ─────────────────────────────────────────
     `wallet_balance` and `wallet_max_percent` come from the server on mount.
     The input is clamped to min(balance, total × percent) — the same ceiling
     place_order() applies, so what the customer sees here always goes through. */
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletPercent, setWalletPercent] = useState(30);
  /* null = "nothing typed yet" → the ceiling is used once the box is ticked.
     A number (including 0) is the customer's own choice and is never
     overridden. */
  const [walletInput, setWalletInput] = useState<number | null>(null);
  /** The customer chooses to spend wallet credit — it is never automatic. */
  const [useWallet, setUseWallet] = useState(false);
  const [walletKnown, setWalletKnown] = useState(false);
  /** The coupon that came with the share link — applied once, if usable. */
  const [suggestedCoupon, setSuggestedCoupon] = useState<string | null>(null);
  /** coupons this account may still use — already filtered by per-user cap */
  const [myCoupons, setMyCoupons] = useState<
    Array<{
      code: string;
      type: string;
      value: number;
      min_order: number;
      description_bn: string | null;
      audience?: string;
      expires_at?: string | null;
    }>
  >([]);
  /** The "সব কুপন" picker. A customer should not have to remember a code, and
   *  neither an influencer's promo code nor an admin-only personal code belongs
   *  in a public-looking list — see pickableCoupons below. */
  const [couponPickerOpen, setCouponPickerOpen] = useState(false);
  /** true until /api/coupons/mine answers — the list used to be "empty" and
   *  "still loading" at the same time, so nothing could tell them apart. */
  const [couponListLoading, setCouponListLoading] = useState(true);
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

  /* ── money: identical rules to computeDelivery() on the server ───────── */
  const isInsideDhaka = form.division === "ঢাকা" && dhakaMetroThanas.has(form.upazila);
  const baseDelivery = isInsideDhaka
    ? rules.inside_dhaka
    : form.district
      ? rules.outside_dhaka
      : 0;
  const freeDelivery = cart.subtotal >= rules.free_over;
  const delivery = cart.items.some((l) => l.kind === "combo") ? 0 : freeDelivery ? 0 : baseDelivery;
  const total = Math.max(0, cart.subtotal + delivery - discount);

  /* Wallet + a "your coupons" strip are only meaningful for a signed-in
     account, and a failure here must never block checkout. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/wallet", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!alive) return;
        setWalletBalance(Number(json.data?.balance ?? 0));
        setWalletPercent(Number(json.data?.max_percent ?? 30));
        setWalletKnown(true);
      } catch {
        /* offline — checkout still works, the wallet just shows 0 */
      }
    })();
    void (async () => {
      try {
        const res = await fetch("/api/coupons/mine", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!alive) return;
        setMyCoupons(json.data?.coupons ?? []);

        /* The visitor arrived from a share link. If that link carries an
           influencer coupon, pre-fill it — the discount is the whole reason
           the code was shared. Never overwrite something they typed. */
        const suggested = json.data?.suggested as string | null;
        if (suggested) {
          setCoupon((current) => (current ? current : suggested));
          setSuggestedCoupon(suggested);
        }
      } catch {
        /* the manual code box still works */
      } finally {
        if (alive) setCouponListLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ── which coupons a customer may PICK from ───────────────────────────
     `all` codes are the shop's public offers — they belong in a list. An
     `influencer` code is revenue that belongs to one person: it must only ever
     arrive through that influencer's link (or be typed by hand), never be
     browsable, or the first customer to open checkout takes the commission off
     every other influencer's share. `assigned` codes are personal — the admin
     hands them out deliberately, so they stay out of the public list too. A
     code the customer typed, or one their share link carried, still applies
     normally. */
  const pickableCoupons = useMemo(
    () =>
      myCoupons.filter(
        (c) => (c.audience ?? "all") === "all" && cart.subtotal >= Number(c.min_order ?? 0)
      ),
    [myCoupons, cart.subtotal]
  );

  /* The wallet may cover a slice of the order, never the whole thing: the
     ceiling is the admin's `wallet_max_percent` (default 30%) and never more
     than the actual balance. */
  const walletMax = Math.max(
    0,
    Math.min(walletBalance, Math.round(((total * walletPercent) / 100) * 100) / 100)
  );
  /* An untouched field means "use the ceiling"; an explicit 0 means "use
     none". `walletInput || walletMax` treated a typed 0 as empty, so the
     customer could not switch the wallet off by clearing the amount. */
  const walletUsedRaw = useWallet
    ? Math.max(0, Math.min(walletInput === null ? walletMax : walletInput, walletMax))
    : 0;
  /** After the payment method's floor is honoured (see methodFloor below). */
  let walletUsed = walletUsedRaw;

  /* If the total drops (coupon, cart edit) below the amount already typed in,
     the wallet part has to shrink with it. */
  useEffect(() => {
    if (walletInput !== null && walletInput > walletMax) setWalletInput(walletMax);
  }, [walletMax, walletInput]);

  /* At most `wallet_max_percent` of an order — the admin's number, shown to the
     customer before they decide. */
  const walletSlots = useMemo(() => {
    const chips = [25, 50, 100]
      .map((share) => ({ share, amount: Math.round(((walletMax * share) / 100) * 100) / 100 }))
      .filter((c) => c.amount > 0);
    return chips;
  }, [walletMax]);

  const selectedMethod = methods.find((m) => m.code === payment) ?? methods[0];

  /* An owner can floor/cap a method (bKash min ৳50, COD max ৳5,000). The floor
     is about what actually goes through the method, so when the wallet would
     leave less than the floor we shrink the wallet part — exactly what
     place_order() does. */
  const methodFloor = Number(selectedMethod?.min_amount ?? 0);
  if (methodFloor > 0 && total - walletUsedRaw < methodFloor) {
    walletUsed = Math.max(0, Math.min(walletUsedRaw, total - methodFloor));
  }
  const payable = Math.max(0, Math.round((total - walletUsed) * 100) / 100);

  const belowMinimum = Boolean(selectedMethod && methodFloor > 0 && total < methodFloor);
  const aboveMaximum = Boolean(
    selectedMethod?.max_amount != null && payable > selectedMethod.max_amount
  );

  /* Apply the share-link coupon by itself once — a customer who arrived from
     an influencer's link expects the discount to already be there. Failure is
     silent: the manual field below still works. */
  useEffect(() => {
    if (!suggestedCoupon || appliedCoupon || discount > 0) return;
    if (!cart.subtotal || cart.subtotal <= 0) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: suggestedCoupon, subtotal: cart.subtotal }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!alive) return;
        setDiscount(Number(json.data?.discount ?? 0));
        setAppliedCoupon(json.data?.code ?? suggestedCoupon);
        toast.success(t("কুপন প্রয়োগ হয়েছে", "Coupon applied"), json.data?.code ?? suggestedCoupon);
      } catch {
        /* ignore — the customer can type the code */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedCoupon, cart.subtotal]);

  const quantity = cart.items.reduce((sum, l) => sum + l.quantity, 0);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function applyAddress(a: Address) {
    /* The box at the top picked an EXISTING row: future edits belong to that
       row, not to whatever checkout last created. */
    setSavedAddressId(a.id);
    setAddressSaved(true);
    setSaveAddress(false);
    setForm((f) => ({
      ...f,
      customer_name: f.customer_name || a.full_name,
      phone: f.phone || a.phone,
      division: a.division,
      district: a.district,
      upazila: a.upazila,
      address: a.address,
    }));
    setErrors({});
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

  /**
   * Save the address currently in the form as the customer's default.
   *
   * Called when step 1 is completed (validateStep1 passed) and the tick is on.
   * It is deliberately best-effort: a failure here must never block an order —
   * the order itself carries its own copy of the address.
   *
   * `savedAddressId` makes it idempotent: editing the address and coming back
   * updates the row instead of creating a second one, and choosing a DIFFERENT
   * saved address at the top of the form clears it (applyAddress) so the edit
   * is written to the right row.
   */
  async function persistAddress(): Promise<void> {
    if (!saveAddress) return;
    if (!form.customer_name.trim() || !form.phone.trim() || !form.address.trim()) return;

    const body = {
      label: t("বাসা", "Home"),
      full_name: form.customer_name.trim(),
      phone: form.phone.trim(),
      division: form.division,
      district: form.district,
      upazila: form.upazila,
      address: form.address.trim(),
      is_default: true,
    };

    setSavingAddress(true);
    try {
      const res = await fetch(
        savedAddressId ? `/api/addresses?id=${encodeURIComponent(savedAddressId)}` : "/api/addresses",
        {
          method: savedAddressId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "ঠিকানা সংরক্ষণ হয়নি");
      if (json.data?.id) setSavedAddressId(json.data.id as string);
      setAddressSaved(true);
      toast.success(t("ঠিকানা সেভ হয়েছে", "Address saved"), t("পরের অর্ডারে নিজে থেকেই বসে যাবে।", "It will be filled in next time."));
    } catch (err) {
      /* Not a blocker: the order goes through with the address it already has. */
      toast.error(t("ঠিকানা সেভ হয়নি", "Could not save the address"), (err as Error).message);
    } finally {
      setSavingAddress(false);
    }
  }

  async function applyCoupon(codeArg?: string) {
    const code = (codeArg ?? coupon).trim();
    if (!code) return;
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal: cart.subtotal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "কুপন সঠিক নয়");
      setDiscount(json.data.discount);
      setAppliedCoupon(json.data.code);
      setSuggestedCoupon(null);
      toast.success(t("কুপন প্রয়োগ হয়েছে", "Coupon applied"), `${json.data.code} — ${money(json.data.discount, isBn)}`);
    } catch (err) {
      setDiscount(0);
      setAppliedCoupon(null);
      toast.error(t("কুপন কাজ করেনি", "Coupon failed"), (err as Error).message);
    } finally {
      setCouponLoading(false);
    }
  }

  function clearCoupon() {
    setCoupon("");
    setAppliedCoupon(null);
    setSuggestedCoupon(null);
    setDiscount(0);
  }

  /** The single CTA in the sticky summary walks the three steps. */
  function advance() {
    if (step === 1) {
      if (validateStep1()) {
        /* Fire and forget: the address is saved while the customer is already
           choosing a payment method. A failed save must not stop the order. */
        void persistAddress();
        setStep(2);
      } else {
        toast.error(t("ঠিকানা পূরণ করুন", "Complete your address"), t("প্রয়োজনীয় ঘরগুলো দিন", "Fill in the required fields"));
      }
      return;
    }
    if (step === 2) {
      if (!payment) {
        toast.error(t("পেমেন্ট মাধ্যম বেছে নিন", "Pick a payment method"));
        return;
      }
      if (belowMinimum || aboveMaximum) {
        toast.error(
          t("এই পেমেন্ট মাধ্যমে এই অর্ডারটি নেওয়া যাবে না", "This method can't take this order"),
          belowMinimum
            ? t(`ন্যূনতম ${money(selectedMethod.min_amount, isBn)}`, `Minimum ${money(selectedMethod.min_amount, isBn)}`)
            : t(`সর্বোচ্চ ${money(selectedMethod.max_amount ?? 0, isBn)}`, `Maximum ${money(selectedMethod.max_amount ?? 0, isBn)}`)
        );
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    if (!agreed) {
      toast.error(t("শর্তে টিক দিন", "Tick the confirmation"), t("তারপর অর্ডার দিন", "Then place the order"));
      return;
    }
    void placeOrder();
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
          wallet_amount: walletUsed,
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

  /* ── loading / empty ─────────────────────────────────────────────────── */
  if (!cart.ready) return <CheckoutShell><CheckoutSkeleton /></CheckoutShell>;

  if (cart.items.length === 0) {
    return (
      <CheckoutShell>
        <div className="container-x py-16">
          <EmptyState
            icon="🛒"
            title={t("চেকআউট করার জন্য কার্ট খালি", "Nothing to check out")}
            body={t("প্রথমে কিছু পণ্য কার্টে যোগ করুন।", "Add some products to your cart first.")}
            action={<Link href="/products" className="btn-primary">পণ্য দেখুন</Link>}
          />
        </div>
      </CheckoutShell>
    );
  }

  const steps = [
    { n: 1 as const, label: t("ঠিকানা", "Address") },
    { n: 2 as const, label: t("পেমেন্ট", "Payment") },
    { n: 3 as const, label: t("রিভিউ", "Review") },
    { n: 4 as const, label: t("নিশ্চিত", "Confirm") },
  ];

  const cta =
    step === 1
      ? t("পেমেন্ট স্টেপে যান", "Continue to payment")
      : step === 2
        ? t("অর্ডার রিভিউ করুন", "Review order")
        : step === 3
          ? t("নিশ্চিতকরণে যান", "Continue to confirm")
          : t(`অর্ডার দিন — ${money(total, isBn)}`, `Place order — ${money(total, isBn)}`);

  return (
    <CheckoutShell>
      {/* ── page intro ─────────────────────────────────────────────────── */}
      <section className="px-3 pt-5 sm:px-6">
        <div className="mx-auto max-w-[1180px]">
          <span className="eyebrow mb-3">
            <Lock className="h-3.5 w-3.5" />
            {t("নিরাপদ চেকআউট", "Secure checkout")}
          </span>
          <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-tight text-neu-ink sm:text-[34px]">
            {t("অর্ডারটি সম্পন্ন করুন", "Complete your order")}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neu-muted">
            {t(
              "তিনটি ধাপে শেষ — ঠিকানা, পেমেন্ট মাধ্যম, তারপর নিশ্চিতকরণ। পেমেন্টের তথ্য আমরা কখনো সংরক্ষণ করি না।",
              "Three short steps — address, payment method, then confirm. We never store your payment details."
            )}
          </p>
        </div>
      </section>

      {/* ── step indicator ─────────────────────────────────────────────── */}
      <ol className="mx-auto mt-5 flex max-w-[1180px] items-center gap-1.5 px-3 sm:px-6">
        {steps.map((s, i) => (
          <li key={s.n} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
            {/* Four labels at ~100 px each do not fit a 390 px phone with the
                old padding — the fourth wrapped onto its own row and read as a
                stray chip. Tighter padding keeps all four on one line. */}
            <button
              type="button"
              onClick={() => s.n < step && setStep(s.n)}
              aria-current={step === s.n ? "step" : undefined}
              className={`chip shrink-0 !px-1.5 !py-1.5 !text-[10.5px] sm:!px-2.5 sm:!text-[11.5px] ${step >= s.n ? "chip-active" : ""} ${s.n < step ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`grid h-4.5 w-4.5 place-items-center rounded-full text-[10px] font-bold ${
                  step >= s.n ? "bg-neu-accent text-white" : "bg-neu-sunken text-neu-faint"
                }`}
              >
                {step > s.n ? <Check className="h-3 w-3" /> : s.n}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 ? (
              <span className={`h-px min-w-1 flex-1 ${step > s.n ? "bg-neu-accent/40" : "bg-neu-line"}`} />
            ) : null}
          </li>
        ))}
      </ol>

      {/* ── unavailable items (server said 409) ────────────────────────── */}
      {unavailable.length ? (
        <div className="mx-auto mt-5 max-w-[1180px] px-3 sm:px-6">
          <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] p-4">
            <p className="text-[13px] font-semibold text-[#c0392b]">
              {t(
                "এই পণ্যগুলো এখন পাওয়া যাচ্ছে না — সরিয়ে দিলেই অর্ডার সম্পন্ন হবে",
                "These items are no longer available — remove them to continue"
              )}
            </p>
            <ul className="mt-2 space-y-1 text-[12px] text-[#a8322a]">
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
              className="btn-ghost btn-sm mt-3 !border-red-500/25 !text-[#c0392b]"
            >
              {t("সরিয়ে ফেলুন", "Remove them")}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── main grid ──────────────────────────────────────────────────── */}
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-6 px-3 py-6 sm:px-6 lg:grid-cols-[1fr_390px]">
        {/* LEFT: the three steps */}
        <div className="flex flex-col gap-5">
          {/* ── 1. delivery address ─────────────────────────────────────── */}
          <section className={`card overflow-hidden transition-opacity ${step !== 1 ? "opacity-70" : ""}`}>
            <CardHeader
              n="1"
              title={t("ডেলিভারি ঠিকানা", "Delivery address")}
              sub={t("পণ্য কোথায় পাঠাবো?", "Where should we deliver?")}
              action={
                step !== 1 ? (
                  <button onClick={() => setStep(1)} className="text-[12px] font-semibold text-neu-accent-strong hover:underline">
                    {t("পরিবর্তন", "Edit")}
                  </button>
                ) : undefined
              }
            />

            {step === 1 ? (
              <div className="space-y-3.5 p-5 sm:p-6">
                {/* saved addresses from the customer's Supabase record */}
                {addresses.length ? (
                  <div className="flex flex-wrap gap-2">
                    <span className="mt-1.5 text-[11.5px] font-medium text-neu-faint">
                      {t("সংরক্ষিত ঠিকানা:", "Saved:")}
                    </span>
                    {addresses.map((a) => (
                      <button key={a.id} type="button" onClick={() => applyAddress(a)} className="chip">
                        <MapPin className="h-3.5 w-3.5 text-neu-accent" />
                        {a.label} · {a.upazila}
                      </button>
                    ))}
                  </div>
                ) : null}

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
                    <FieldError msg={errors.customer_name} />
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
                    <FieldError msg={errors.phone} />
                  </label>

                  <label className="sm:col-span-2">
                    <span className="label">{t("ইমেইল (ঐচ্ছিক)", "Email (optional)")}</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      className="input"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    <FieldError msg={errors.email} />
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
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <FieldError msg={errors.division} />
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
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <FieldError msg={errors.district} />
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
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <FieldError msg={errors.upazila} />
                  </label>

                  <p className="flex items-center gap-1.5 self-end pb-2 text-[11.5px] text-neu-muted sm:col-span-2">
                    <Truck className="h-3.5 w-3.5 shrink-0 text-neu-accent" />
                    {t("ডেলিভারি চার্জ", "Delivery fee")}:{" "}
                    <span className={`font-semibold ${delivery === 0 ? "text-neu-accent-strong" : "text-neu-ink"}`}>
                      {delivery === 0 ? t("ফ্রি", "Free") : money(delivery, isBn)}
                    </span>
                    {form.upazila ? (
                      <span className="text-neu-faint">
                        · {isInsideDhaka ? t("ঢাকার ভেতরে", "inside Dhaka") : t("ঢাকার বাইরে", "outside Dhaka")}
                      </span>
                    ) : null}
                  </p>
                </div>

                <label>
                  <span className="label">{t("সম্পূর্ণ ঠিকানা", "Full address")} *</span>
                  <textarea
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    className="input min-h-[84px] resize-y"
                    placeholder={t("ঘর/ফ্লাট, রাস্তা, এলাকা — ডেলিভারির জন্য প্রস্তুত", "House/flat, street, area — delivery-ready")}
                  />
                  <FieldError msg={errors.address} />
                </label>

                <label>
                  <span className="label">{t("ডেলিভারি নোট (ঐচ্ছিক)", "Delivery note (optional)")}</span>
                  <textarea
                    value={form.delivery_note}
                    onChange={(e) => update("delivery_note", e.target.value)}
                    className="input min-h-[64px] resize-y"
                    placeholder={t("যেমন: দুপুর ২–৪ টার মধ্যে পাঠান", "e.g. deliver between 2–4 pm")}
                  />
                </label>

                {/* Save for next time. The tick is on by default when the
                    account has no address yet, and the number/save happen the
                    moment this step is completed — not at the end of the
                    checkout, where a failure would be invisible. */}
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-neu-accent/25 bg-neu-accent/[0.06] p-3">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => {
                      setSaveAddress(e.target.checked);
                      if (!e.target.checked) setAddressSaved(false);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--neu-accent)]"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-neu-ink">
                      <BookmarkPlus className="h-3.5 w-3.5 text-neu-accent" />
                      {t("এই ঠিকানাটি পরের অর্ডারের জন্য সেভ করুন", "Save this address for next time")}
                      {savingAddress ? <Spinner className="h-3 w-3 text-neu-accent" /> : null}
                      {addressSaved && !savingAddress ? (
                        <span className="flex items-center gap-1 rounded-full bg-neu-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-neu-accent-strong">
                          <Check className="h-2.5 w-2.5" /> {t("সেভ হয়েছে", "Saved")}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-neu-muted">
                      {t(
                        "টিক থাকলে পরেরবার চেকআউটে এই ঠিকানাটি নিজে থেকেই বসে যাবে, আর উপরের সংরক্ষিত ঠিকানার তালিকাতেও থাকবে।",
                        "Tick it and this address is filled in automatically next time, and appears in the saved list above."
                      )}
                    </span>
                  </span>
                </label>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <dl className="grid gap-y-1.5 text-[13px]">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-neu-faint">
                    {t("পাঠানো হবে", "Delivering to")}
                  </dt>
                  <dd className="mt-0.5 font-semibold text-neu-ink">{form.customer_name} · {form.phone}</dd>
                  {form.email ? <dd className="text-neu-muted">{form.email}</dd> : null}
                  <dd className="mt-1 text-neu-ink/80">
                    {form.division} · {form.district} · {form.upazila}
                  </dd>
                  <dd className="text-neu-muted">{form.address}</dd>
                  {form.delivery_note ? (
                    <dd className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-neu-accent/10 px-2.5 py-1 text-[11.5px] text-neu-accent-strong">
                      📝 {form.delivery_note}
                    </dd>
                  ) : null}
                </dl>
              </div>
            )}
          </section>

          {/* ── 2. payment method ──────────────────────────────────────── */}
          <section className={`card overflow-hidden transition-opacity ${step !== 2 ? "opacity-70" : ""}`}>
            <CardHeader
              n="2"
              title={t("পেমেন্ট মাধ্যম", "Payment method")}
              sub={t("অ্যাডমিন প্যানেল থেকে চালু করা মাধ্যমগুলো", "The methods enabled in the admin panel")}
              action={
                step > 2 ? (
                  <button onClick={() => setStep(2)} className="text-[12px] font-semibold text-neu-accent-strong hover:underline">
                    {t("পরিবর্তন", "Edit")}
                  </button>
                ) : undefined
              }
            />

            {/* Virtual balance — deliberately ABOVE the payment methods: the
                customer must see it (and the admin's % cap) before choosing how
                to pay the rest. */}
            {walletKnown ? (
              <div className="border-b border-neu-line/60 bg-neu-sunken/40 px-5 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-neu-ink">
                    <Wallet className="h-3.5 w-3.5 text-neu-accent-strong" />
                    {t("ভার্চুয়াল ব্যালেন্স", "Virtual balance")}
                  </span>
                  <span className="text-[12.5px] font-bold text-neu-accent-strong">
                    {money(walletBalance, isBn)}
                  </span>
                </div>

                {walletBalance > 0 ? (
                  <>
                    <p className="mt-1 text-[11px] leading-relaxed text-neu-muted">
                      {t(
                        `এই অর্ডারে সর্বোচ্চ ${money(walletMax, isBn)} ব্যবহার করা যাবে — মোটের ${walletPercent}%`,
                        `You may use up to ${money(walletMax, isBn)} on this order — ${walletPercent}% of the total`
                      )}
                    </p>

                    <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 rounded-xl border border-neu-line/60 bg-neu-surface px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={useWallet}
                        onChange={(e) => {
                          setUseWallet(e.target.checked);
                          if (e.target.checked && walletInput === null) setWalletInput(walletMax);
                        }}
                        className="h-4 w-4 rounded border-neu-line accent-[var(--neu-accent,#2f855a)]"
                      />
                      <span className="text-[12.5px] font-medium text-neu-ink">
                        {t("ব্যালেন্স ব্যবহার করব", "Use my balance")}
                      </span>
                    </label>

                    {useWallet ? (
                      <>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            min={0}
                            max={walletMax}
                            step="any"
                            value={walletUsed || ""}
                            onChange={(e) => setWalletInput(Math.max(0, Number(e.target.value) || 0))}
                            className="input !py-2.5 text-[13px]"
                            placeholder={t("কত টাকা ব্যবহার করবেন", "Amount to use")}
                          />
                          <button
                            type="button"
                            onClick={() => setWalletInput(walletMax)}
                            disabled={walletMax <= 0}
                            className="btn-ghost shrink-0 !py-2.5 text-[12.5px] disabled:opacity-50"
                          >
                            {t("সর্বোচ্চ", "Max")}
                          </button>
                        </div>
                        {walletSlots.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {walletSlots.map((c) => (
                              <button
                                key={c.share}
                                type="button"
                                onClick={() => setWalletInput(c.amount)}
                                className="rounded-full border border-neu-accent/25 bg-neu-accent/[0.06] px-2.5 py-1 text-[11px] font-semibold text-neu-accent-strong hover:bg-neu-accent/15"
                              >
                                {c.share === 100 ? t("সর্বোচ্চ", "Max") : `${c.share}%`} · {money(c.amount, isBn)}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-[11px] leading-relaxed text-neu-muted">
                    {t(
                      "বন্ধুকে রেফার করলে বা অর্ডারে কমিশন পেলে এখানে জমা হবে। /account/wallet দেখুন।",
                      "Earn credit by referring friends — it collects here. See /account/wallet."
                    )}
                  </p>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3 p-5 sm:p-6">
                {methods.map((m) => {
                  const selected = m.code === payment;
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => setPayment(m.code)}
                      aria-pressed={selected}
                      className={`flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all ${
                        selected
                          ? "border-neu-accent/45 bg-neu-accent/[0.07] shadow-neu-accent-sm"
                          : "border-neu-line/60 bg-neu-surface hover:border-neu-accent/25"
                      }`}
                    >
                      <span
                        className={`relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl text-[20px] ${
                          selected ? "bg-white" : "neu-raised-xs"
                        }`}
                      >
                        {m.logo_url && canOptimize(m.logo_url) ? (
                          <Image src={m.logo_url} alt="" fill className="object-contain p-1.5" sizes="48px" />
                        ) : (
                          <MethodIcon code={m.code} className="h-5 w-5 text-neu-accent-strong" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-[14px] font-bold text-neu-ink">{isBn ? m.name_bn : m.name_en || m.name_bn}</span>
                          {m.kind === "cod" ? (
                            <span className="badge !bg-neu-accent/10 !text-neu-accent-strong">{t("ডেলিভারিতে বুঝবেন", "Pay on delivery")}</span>
                          ) : null}
                        </span>
                        {m.kind === "cod" ? (
                          <span className="mt-0.5 block text-[12px] text-neu-muted">
                            {m.instruction_bn ?? t("পণ্য হাতে পেয়ে টাকা দিন।", "Pay when you receive your order.")}
                          </span>
                        ) : (
                          <span className="mt-0.5 block truncate font-mono text-[12.5px] text-neu-accent-strong">
                            {m.account_number ?? m.bank_name ?? "—"}
                          </span>
                        )}
                        {m.min_amount > 0 || m.max_amount != null ? (
                          <span className="mt-0.5 block text-[11px] text-neu-faint">
                            {m.min_amount > 0 ? t(`ন্যূনতম ${money(m.min_amount, isBn)}`, `Min ${money(m.min_amount, isBn)}`) : null}
                            {m.min_amount > 0 && m.max_amount != null ? " · " : ""}
                            {m.max_amount != null ? t(`সর্বোচ্চ ${money(m.max_amount, isBn)}`, `Max ${money(m.max_amount, isBn)}`) : null}
                          </span>
                        ) : null}
                      </span>

                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
                          selected ? "border-neu-accent bg-neu-accent text-white" : "border-neu-line text-transparent"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}

                {walletUsedRaw > walletUsed && walletUsedRaw > 0 ? (
                  <p className="rounded-xl bg-neu-accent/[0.07] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-neu-accent-strong">
                    {t(
                      `${selectedMethod?.name_bn ?? "এই মাধ্যম"} দিয়ে কমপক্ষে ${money(methodFloor, isBn)} পাঠাতে হয় — তাই ওয়ালেট থেকে ${money(walletUsed, isBn)} কাটা হবে, বাকিটা এই মাধ্যমে দেবেন।`,
                      `${selectedMethod?.name_en ?? "This method"} needs at least ${money(methodFloor, isBn)}, so ${money(walletUsed, isBn)} will come from the wallet and the rest through the method.`
                    )}
                  </p>
                ) : null}

                {(belowMinimum || aboveMaximum) && selectedMethod ? (
                  <p className="rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-[12px] font-medium text-[#8a6a12]">
                    {belowMinimum
                      ? t(
                          `এই মাধ্যমে সর্বনিম্ন অর্ডার ${money(selectedMethod.min_amount, isBn)} — অন্য মাধ্যম বেছে নিন`,
                          `This method needs at least ${money(selectedMethod.min_amount, isBn)} — pick another method`
                        )
                      : t(
                          `এই মাধ্যমে সর্বোচ্চ অর্ডার ${money(selectedMethod.max_amount ?? 0, isBn)} — অন্য মাধ্যম বেছে নিন`,
                          `This method is capped at ${money(selectedMethod.max_amount ?? 0, isBn)} — pick another method`
                        )}
                  </p>
                ) : null}

                <p className="flex items-center gap-1.5 pt-1 text-[11.5px] text-neu-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-neu-accent" />
                  {t(
                    "টাকা পাঠানোর পর অ্যাডমিন যাচাই করে অর্ডার নিশ্চিত করবেন",
                    "The admin verifies your payment before the order is confirmed"
                  )}
                </p>

                <div className="rounded-2xl border border-neu-line/60 bg-neu-surface/60 p-3.5">
                      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-neu-ink">
                        <Tag className="h-3.5 w-3.5 text-neu-accent" />
                        {t("কুপন কোড", "Coupon code")}
                        <span className="font-normal text-neu-faint">{t("(এই ধাপে প্রয়োগ করুন)", "(apply here)")}</span>
                      </p>
                    {appliedCoupon ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-neu-accent/25 bg-neu-accent/[0.08] px-3 py-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-neu-accent-strong">
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{appliedCoupon}</span>
                        <span className="text-neu-muted">− {money(discount, isBn)}</span>
                      </span>
                      <button type="button" onClick={clearCoupon} aria-label={t("কুপন সরান", "Remove coupon")} className="text-neu-muted hover:text-[#c0392b]">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                        /* `min-w-0` + `!w-auto`: `.input` is `w-full`, and inside
                           this flex row its min-content width pushed the Apply
                           button out of the card. The box now shrinks instead. */
                        className="input !w-auto min-w-0 flex-1 !py-2.5 text-[13px]"
                        placeholder={t("কুপন কোড (ঐচ্ছিক)", "Coupon code (optional)")}
                        autoComplete="off"
                        aria-label={t("কুপন কোড", "Coupon code")}
                      />
                      <button
                        type="button"
                        onClick={() => void applyCoupon()}
                        disabled={couponLoading || !coupon.trim()}
                        className="btn-ghost shrink-0 !py-2.5 text-[13px] disabled:opacity-50"
                      >
                        {couponLoading ? <Spinner className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
                        {t("প্রয়োগ", "Apply")}
                      </button>
                    </div>
                  )}

                  {/* The account's own usable codes. Four tiny chips used to be
                      the whole story — a customer could not see what the shop
                      actually offers, could not see how much they would save, and
                      had no way to browse.

                      This used to render ONLY when `pickableCoupons.length > 0`,
                      which is why it vanished on a real checkout: any hiccup in
                      /api/coupons/mine (or a shop with no public code yet) hid the
                      one way to browse coupons. It is now always here; the count
                      line is what changes. */}
                  {!appliedCoupon ? (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCouponPickerOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={couponPickerOpen}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-neu-accent/25 bg-neu-accent/[0.06] px-3 py-2 text-left transition hover:bg-neu-accent/[0.12]"
                      >
                        <Ticket className="h-4 w-4 shrink-0 text-neu-accent-strong" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-neu-ink">
                            {t("সব কুপন দেখুন", "See all coupons")}
                          </span>
                          <span className="block text-[10.5px] text-neu-muted">
                            {couponListLoading
                              ? t("কুপন খোঁজা হচ্ছে…", "Looking up coupons…")
                              : pickableCoupons.length
                                ? t(
                                    `${pickableCoupons.length}টি কুপন আপনার অর্ডারে প্রযোজ্য`,
                                    `${pickableCoupons.length} coupons apply to this order`
                                  )
                                : t(
                                    "এখন কোনো পাবলিক কুপন নেই — কোড থাকলে উপরে লিখুন",
                                    "No public coupon right now — type a code above"
                                  )}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-neu-accent px-2 py-0.5 text-[10.5px] font-bold text-white">
                          {t("দেখুন", "View")}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-3 rounded-xl border border-neu-line/60 bg-neu-surface p-3.5">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-lg">
                    {selectedMethod?.logo_url && canOptimize(selectedMethod.logo_url) ? (
                      <Image src={selectedMethod.logo_url} alt="" fill className="object-contain p-1" sizes="44px" />
                    ) : (
                      <MethodIcon code={selectedMethod?.code ?? ""} className="h-[18px] w-[18px] text-neu-accent-strong" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-neu-ink">
                      {selectedMethod ? (isBn ? selectedMethod.name_bn : selectedMethod.name_en || selectedMethod.name_bn) : "—"}
                    </p>
                    {selectedMethod?.kind !== "cod" && selectedMethod?.account_number ? (
                      <p className="mt-0.5 truncate font-mono text-[12px] text-neu-accent-strong">{selectedMethod.account_number}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── 3. review ──────────────────────────────────────────────── */}
          {step === 3 ? (
            <section className="card overflow-hidden">
              <CardHeader
                n="3"
                title={t("অর্ডার রিভিউ", "Review your order")}
                sub={t("ঠিকানা, পেমেন্ট ও পণ্য একসাথে দেখে নিন", "Address, payment and items in one place")}
                action={
                  <span className="chip !py-1 !text-[11px] text-neu-muted">
                    {t("পড়ে নিন", "Read-only")}
                  </span>
                }
              />
              <div className="space-y-3.5 p-5 sm:p-6">
                <Recap label={t("ডেলিভারি", "Delivery")} icon={<MapPin className="h-4 w-4 text-neu-accent" />}>
                  <p className="text-[13px] font-semibold text-neu-ink">{form.customer_name} · {form.phone}</p>
                  <p className="mt-0.5 text-[12.5px] text-neu-muted">{form.division} · {form.district} · {form.upazila}</p>
                  <p className="mt-0.5 text-[12.5px] text-neu-muted">{form.address}</p>
                </Recap>

                <Recap label={t("পেমেন্ট", "Payment")} icon={<CreditCard className="h-4 w-4 text-neu-accent" />}>
                  <p className="text-[13px] font-semibold text-neu-ink">
                    {selectedMethod ? (isBn ? selectedMethod.name_bn : selectedMethod.name_en || selectedMethod.name_bn) : "—"}
                  </p>
                  {selectedMethod?.kind !== "cod" && selectedMethod?.account_number ? (
                    <p className="mt-0.5 font-mono text-[12px] text-neu-accent-strong">{selectedMethod.account_number}</p>
                  ) : null}
                </Recap>

                <Recap
                  label={`${t("পণ্য", "Items")} (${cart.items.length})`}
                  icon={<ShoppingBag className="h-4 w-4 text-neu-accent" />}
                >
                  <ul className="space-y-1.5">
                    {cart.items.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                        <span className="min-w-0 truncate text-neu-ink/80">
                          {isBn ? l.nameBn : l.nameEn}
                          <span className="text-neu-faint"> × {l.quantity}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-neu-ink">{money(l.price * l.quantity, isBn)}</span>
                      </li>
                    ))}
                  </ul>
                </Recap>

                <p className="flex items-center gap-1.5 text-[11px] text-neu-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-neu-accent" />
                  {t(
                    "অর্ডার দেওয়ার পর পেমেন্ট নির্দেশনা দেখতে পাবেন",
                    "You'll see payment instructions after placing the order"
                  )}
                </p>
              </div>
            </section>
          ) : null}

          {/* ── 4. confirm ───────────────────────────────────────────────
              Splitting review from confirm is deliberate: step 3 is where the
              customer *checks* (nothing is clickable there), step 4 is the one
              screen that actually spends money. Placing the order from the same
              screen that asked them to verify made both feel like a form. */}
          {step === 4 ? (
            <section className="card overflow-hidden">
              <CardHeader
                n="4"
                title={t("নিশ্চিত করুন", "Confirm")}
                sub={t("শেষ ধাপ — এরপর অর্ডার চলে যাবে", "Last step — the order goes in after this")}
              />
              <div className="space-y-3 p-5 sm:p-6">
                <ul className="space-y-2.5">
                  {[
                    {
                      label: t("ডেলিভারি হবে", "Delivering to"),
                      value: `${form.customer_name} · ${form.phone}`,
                      sub: `${form.division} · ${form.district} · ${form.upazila}`,
                      changeTo: 1 as Step,
                    },
                    {
                      label: t("পেমেন্ট", "Paying with"),
                      value: selectedMethod
                        ? isBn
                          ? selectedMethod.name_bn
                          : selectedMethod.name_en || selectedMethod.name_bn
                        : "—",
                      sub:
                        selectedMethod?.kind !== "cod" && selectedMethod?.account_number
                          ? selectedMethod.account_number
                          : t("ডেলিভারির সময় পরিশোধ", "Pay when it arrives"),
                      changeTo: 2 as Step,
                    },
                    {
                      label: t("মোট", "Total"),
                      value: money(payable, isBn),
                      sub: t(`${cart.items.length} টি পণ্য`, `${cart.items.length} items`),
                      changeTo: null,
                    },
                  ].map((row) => (
                    <li
                      key={row.label}
                      className="flex items-start justify-between gap-4 rounded-xl border border-neu-line/60 px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-neu-faint">
                          {row.label}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] font-semibold text-neu-ink">{row.value}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-neu-muted">{row.sub}</p>
                      </div>
                      {row.changeTo ? (
                        <button
                          type="button"
                          onClick={() => setStep(row.changeTo as Step)}
                          className="shrink-0 text-[11.5px] font-semibold text-neu-accent-strong hover:underline"
                        >
                          {t("বদলান", "Change")}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-neu-sunken/50 p-3">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--neu-accent)]"
                  />
                  <span className="text-[12px] leading-relaxed text-neu-muted">
                    {t(
                      "আমি অর্ডারের তথ্য যাচাই করেছি এবং শর্তাবলী মেনে নিচ্ছি।",
                      "I have checked the details and accept the terms."
                    )}
                  </span>
                </label>
              </div>
            </section>
          ) : null}
        </div>

        {/* RIGHT: sticky order summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-neu-line/60 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neu-accent-strong">
                  {t("অর্ডার সারসংক্ষেপ", "Order summary")}
                </p>
                <p className="mt-0.5 text-[12px] text-neu-muted">{t("যা যা অর্ডার করছেন", "What you're ordering")}</p>
              </div>
              <span className="neu-pill px-3 py-1 text-[12px] font-semibold !text-neu-ink">
                {t(`${quantity} টি পণ্য`, `${quantity} items`)}
              </span>
            </div>

            {/* items */}
            <ul className="divide-y divide-neu-line/50">
              {cart.items.slice(0, 4).map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl neu-raised-xs text-[13px] font-bold text-neu-accent-strong">
                    {l.image && canOptimize(l.image) ? (
                      <Image src={l.image} alt="" fill className="object-cover" sizes="44px" />
                    ) : (
                      (isBn ? l.nameBn : l.nameEn).charAt(0)
                    )}
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
              {cart.items.length > 4 ? (
                <li className="px-5 py-3 text-[12px] text-neu-muted sm:px-6">
                  +{cart.items.length - 4} {t("টি আরও", "more")}
                </li>
              ) : null}
            </ul>

            {/* totalled from here down; the coupon ENTRY lives in the payment
                step above, which is the only step where applying one is legal */}
            <dl className="space-y-2 border-t border-neu-line/60 px-5 py-4 text-[13px] sm:px-6">
              <Row label={t("সাবটোটাল", "Subtotal")} value={money(cart.subtotal, isBn)} />
              <Row
                label={t("ডেলিভারি", "Delivery")}
                value={delivery === 0 ? t("ফ্রি", "Free") : money(delivery, isBn)}
                accent={delivery === 0}
              />
              {discount > 0 ? <Row label={t("ছাড়", "Discount")} value={`− ${money(discount, isBn)}`} accent /> : null}
              {appliedCoupon ? (
                <p className="flex items-center gap-1.5 text-[11px] text-neu-accent-strong">
                  <Tag className="h-3 w-3" />
                  {t(`${appliedCoupon} প্রয়োগ করা আছে`, `${appliedCoupon} applied`)}
                </p>
              ) : null}
              {walletUsed > 0 ? (
                <Row label={t("ওয়ালেট থেকে", "From wallet")} value={`− ${money(walletUsed, isBn)}`} accent />
              ) : null}
              {freeDelivery ? (
                <p className="rounded-lg bg-neu-accent/10 px-2.5 py-1.5 text-[11px] font-semibold text-neu-accent-strong">
                  {t("ফ্রি ডেলিভারি পেয়েছেন", "You got free delivery")}
                </p>
              ) : null}
              <div className="mt-1 flex items-center justify-between border-t border-neu-line/60 pt-3">
                <dt className="text-[14px] font-bold text-neu-ink">
                  {walletUsed > 0 ? t("পরিশোধ করতে হবে", "To pay") : t("মোট", "Total")}
                </dt>
                <dd className="text-[19px] font-extrabold text-neu-accent-strong">
                  {money(payable, isBn)}
                </dd>
              </div>
            </dl>

            {/* the single CTA */}
            <div className="px-5 pb-5 sm:px-6">
              <button
                type="button"
                onClick={advance}
                disabled={submitting || (step === 4 && !agreed)}
                className="btn-primary w-full !py-3.5 !text-[15px]"
              >
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    {t("অর্ডার দেওয়া হচ্ছে…", "Placing order…")}
                  </>
                ) : (
                  <>
                    {step < 4 ? <Lock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    {cta}
                    {step < 4 ? <ChevronRight className="h-4 w-4" /> : null}
                  </>
                )}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neu-muted">
                <Wallet className="h-3.5 w-3.5 text-neu-accent" />
                {t("ক্যাশ অন ডেলিভারি ও মোবাইল ব্যাংকিং দুটোই আছে", "Cash on delivery and mobile banking both available")}
              </p>
            </div>
          </div>

          {/* The number here is the one the owner sets in /foisal/settings.
              It used to be typed into this file as ০১৭০০-০০০০০০, so editing
              the panel changed the header and footer but not checkout — and
              the checkout page is where a customer panics. */}
          <div className="card mt-4 p-4">
            <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-neu-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neu-accent" />
              {t(
                "সমস্যা হলে কল করুন বা হোয়াটসঅ্যাপে লিখুন — অর্ডার দেওয়ার আগেই উত্তর পাবেন।",
                "Stuck? Call or message us on WhatsApp — an answer before you pay."
              )}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a
                href={`tel:${store.phone}`}
                className="chip !py-1.5 !text-[11.5px] font-semibold"
              >
                <Phone className="h-3.5 w-3.5 text-neu-accent" />
                <span className="tabular-nums">{store.phone_display}</span>
              </a>
              <a
                href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(
                  t("আমার অর্ডার নিয়ে সাহায্য দরকার।", "I need help with my order.")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="chip !py-1.5 !text-[11.5px] font-semibold"
              >
                <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                {t("হোয়াটসঅ্যাপ", "WhatsApp")}
              </a>
              <span className="chip !py-1.5 !text-[11.5px] text-neu-muted">
                <Clock className="h-3.5 w-3.5" />
                {t(store.hours_bn, store.hours_en)}
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* ── সব কুপন ─────────────────────────────────────────────────────
          A proper list instead of four mystery chips: what the code gives,
          what it needs, when it expires, and one tap to apply. Only `all`
          codes are in here (pickableCoupons) — an influencer's promo code is
          never browsable. */}
      {/* The picker only exists while the payment step is on screen. Moving it
          out of the summary card was the whole point: "সব কুপন দেখুন" must not
          sit next to a Review screen that cannot apply anything. */}
      {couponPickerOpen && step === 2 ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-end bg-neu-ink/45 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("সব কুপন", "All coupons")}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCouponPickerOpen(false);
          }}
        >
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-[22px] bg-neu-surface p-4 shadow-neu-lg sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-bold text-neu-ink">
                  {t(`আপনার জন্য ${pickableCoupons.length}টি কুপন`, `${pickableCoupons.length} coupons for you`)}
                </p>
                <p className="text-[11px] text-neu-muted">
                  {t("ট্যাপ করলেই অর্ডারে যোগ হবে", "Tap one to apply it")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCouponPickerOpen(false)}
                aria-label={t("বন্ধ করুন", "Close")}
                className="neu-icon-btn h-8 w-8 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="space-y-2">
              {pickableCoupons.map((c) => {
                const saving =
                  c.type === "percent"
                    ? (cart.subtotal * Number(c.value)) / 100
                    : Math.min(Number(c.value), cart.subtotal);
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setCouponPickerOpen(false);
                        void applyCoupon(c.code);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-neu-accent/25 bg-white/70 p-3 text-left transition hover:border-neu-accent/50 hover:bg-neu-accent/[0.08]"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-neu-accent/[0.12] text-neu-accent-strong">
                        <Ticket className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-mono text-[13px] font-bold text-neu-ink">{c.code}</span>
                          <span className="shrink-0 rounded-full bg-neu-accent px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                            {c.type === "percent" ? `${c.value}%` : money(c.value, isBn)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-neu-muted">
                          {c.description_bn ??
                            t(
                              `${money(c.min_order, isBn)} এর বেশি অর্ডারে`,
                              `On orders over ${money(c.min_order, isBn)}`
                            )}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] font-semibold text-neu-accent-strong">
                          {t(`সাশ্রয় ≈ ${money(saving, isBn)}`, `Saves ≈ ${money(saving, isBn)}`)}
                          {c.expires_at
                            ? ` · ${t("মেয়াদ", "Valid till")} ${formatShortDate(c.expires_at)}`
                            : ""}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-neu-accent-strong" />
                    </button>
                  </li>
                );
              })}
            </ul>

            {!pickableCoupons.length ? (
              <div className="rounded-xl border border-dashed border-neu-line/70 px-3 py-6 text-center">
                <p className="text-[12px] font-semibold text-neu-ink">
                  {couponListLoading
                    ? t("কুপন খোঁজা হচ্ছে…", "Looking up coupons…")
                    : myCoupons.length
                      ? t("এই অর্ডারের জন্য কোনো কুপন এখন প্রযোজ্য নয়", "No coupon applies to this order yet")
                      : t("এখন কোনো পাবলিক কুপন নেই", "No public coupon right now")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-neu-muted">
                  {t(
                    "ইনফ্লুয়েন্সার বা ব্যক্তিগত কোড পেলে উপরের ঘরে লিখে প্রয়োগ করুন।",
                    "If you have an influencer or personal code, type it in the box and apply."
                  )}
                </p>
              </div>
            ) : null}

            <p className="mt-3 rounded-xl bg-neu-sunken/60 p-2.5 text-[10.5px] leading-relaxed text-neu-muted">
              {t(
                "ইনফ্লুয়েন্সার বা ব্যক্তিগত কোড থাকলে সেটি উপরের ঘরে লিখে প্রয়োগ করুন।",
                "Have an influencer or personal code? Type it in the box above to apply it."
              )}
            </p>
          </div>
        </div>
      ) : null}
    </CheckoutShell>
  );
}

/* ── shared chrome ──────────────────────────────────────────────────────── */

function CheckoutShell({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="min-h-dvh bg-neu-bg font-sans text-neu-ink">
      <header
        className="sticky top-0 z-40 px-3 sm:px-6"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="neu-bar mx-auto flex max-w-[1180px] items-center justify-between rounded-[24px] px-4 py-3 sm:px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={34} href={null} />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {[
              { href: "/products", label: "পণ্য" },
              { href: "/combos", label: "কম্বো" },
              { href: "/subscription", label: "সাবস্ক্রিপশন" },
              { href: "/farm", label: "খামার" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[13px] font-medium text-neu-muted transition-colors hover:text-neu-accent-strong"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <span className="neu-pill hidden items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold !text-neu-accent-strong sm:flex">
              <Lock className="h-3.5 w-3.5" />
              {t("নিরাপদ", "Secure")}
            </span>
            <Link
              href="/cart"
              className="neu-pill flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold !text-neu-ink"
            >
              <ShoppingBag className="h-4 w-4 text-neu-accent" />
              {t("কার্ট", "Cart")}
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-6 border-t border-neu-line/50 bg-neu-surface/70">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-2 px-6 py-5 text-[12px] text-neu-muted sm:flex-row">
          <span className="flex items-center gap-2 font-semibold text-neu-ink">
            <Logo size={22} showText={false} href={null} />
            বিশ্বাস এগ্রো · Farm to Family
          </span>
          <span>© {new Date().getFullYear()} {t("বিশ্বাস এগ্রো", "Biswas Agro")}</span>
        </div>
      </footer>
    </div>
  );
}

/* ── small presentational pieces ───────────────────────────────────────── */

function CardHeader({
  n,
  title,
  sub,
  action,
}: {
  n: string;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-neu-line/60 px-5 py-4 sm:px-6">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neu-accent/12 text-[12px] font-extrabold text-neu-accent-strong">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold leading-tight text-neu-ink">{title}</h2>
        <p className="text-[12px] text-neu-muted">{sub}</p>
      </div>
      {action}
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-[11.5px] font-medium text-[#c0392b]">{msg}</p>;
}

/** "১৫ ডিসেম্বর" — the year only when it is not this one. */
function formatShortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neu-muted">{label}</dt>
      <dd className={`font-semibold ${accent ? "text-neu-accent-strong" : "text-neu-ink"}`}>{value}</dd>
    </div>
  );
}

function Recap({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neu-line/60 bg-neu-surface p-3.5">
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-neu-faint">
        {icon}
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-64 rounded-3xl" />
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    </div>
  );
}
