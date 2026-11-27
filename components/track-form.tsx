"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, MapPin, PackageSearch, XCircle } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { formatDateTimeBn, money } from "@/lib/format";
import { orderStatusSteps } from "@/lib/site";
import { Spinner } from "./ui";
import type { Order, OrderItem } from "@/lib/types";

export function TrackForm({ initialOrder }: { initialOrder: string }) {
  const { t } = useLocale();
  const toast = useToast();
  const [orderNo, setOrderNo] = useState(initialOrder);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* The tracking API deliberately returns a narrow shape: no street address,
     no ids, no payment reference. See app/api/orders/track/route.ts. Typing it
     here is what stops a future edit from reading a field that is not sent and
     silently rendering "undefined". */
  type TrackedItem = Pick<OrderItem, "name_bn" | "quantity" | "price">;
  const [order, setOrder] = useState<
    (Omit<Order, "address" | "order_items"> & { order_items: TrackedItem[] }) | null
  >(null);

  async function lookup(o: string, p: string) {
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(`/api/orders/track?order=${encodeURIComponent(o)}&phone=${encodeURIComponent(p)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "অর্ডার পাওয়া যায়নি");
      setOrder(json.data);
    } catch (err) {
      setError((err as Error).message);
      toast.error(t("খুঁজে পাওয়া যায়নি", "Not found"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await lookup(orderNo.trim(), phone.trim());
  }

  // auto-lookup when arriving from a link with ?order=...
  useEffect(() => {
    if (initialOrder && !phone) {
      // cannot verify without phone — just prefill and let the user complete it
    }
  }, [initialOrder, phone]);

  const currentIndex = order ? orderStatusSteps.findIndex((s) => s.key === order.status) : -1;

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">{t("অর্ডার নম্বর", "Order number")} *</span>
            <input
              required
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value.toUpperCase())}
              className="input font-mono"
              placeholder="BA1234567890"
            />
          </label>
          <label>
            <span className="label">{t("মোবাইল নম্বর", "Mobile number")} *</span>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              inputMode="tel"
              placeholder="01712345678"
            />
          </label>
        </div>

        <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
          {loading ? <Spinner /> : <PackageSearch className="h-4 w-4" />}
          {t("অর্ডার খুঁজুন", "Track order")}
        </button>

        {error ? (
          <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[12px] text-red-200">{error}</p>
        ) : null}
      </form>

      {order ? (
        <div className="card p-5 animate-fade-up">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div>
              <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">অর্ডার নম্বর</p>
              <p className="font-mono text-base font-bold text-leaf-200">{order.order_no}</p>
            </div>
            <div className="text-right">
              <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">সর্বশেষ আপডেট</p>
              <p className="text-[12px] font-medium">{formatDateTimeBn(order.updated_at ?? order.created_at)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">মোট</p>
              <p className="text-base font-bold text-leaf-200">{money(Number(order.total), true)}</p>
            </div>
          </div>

          {order.status === "cancelled" ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-[12.5px] text-red-200">
              <XCircle className="h-4 w-4" /> এই অর্ডারটি বাতিল করা হয়েছে।
            </div>
          ) : (
            <ol className="mt-5">
              {orderStatusSteps.map((s, i) => {
                const done = i <= currentIndex;
                const current = i === currentIndex;
                return (
                  <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < orderStatusSteps.length - 1 ? (
                      <span
                        className={`absolute left-[13px] top-7 h-full w-0.5 ${done && i < currentIndex ? "bg-leaf-500" : "bg-white/10"}`}
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] ${
                        done ? "bg-leaf-500 text-ink-900" : "bg-ink-700 text-sand-100/40"
                      } ${current ? "ring-4 ring-leaf-500/20" : ""}`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : s.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-semibold ${done ? "text-sand-100" : "text-sand-100/45"}`}>
                        {s.bn}{" "}
                        {current ? (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-leaf-600/20 px-2 py-0.5 text-[9.5px] font-bold text-leaf-700">
                            <Clock className="h-2.5 w-2.5" /> চলমান
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-sand-100/40">
                        {i === 0 ? formatDateTimeBn(order.created_at) : done ? "সম্পন্ন" : "অপেক্ষমাণ"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-4 space-y-1.5 rounded-xl bg-white/[0.03] p-3 text-[12px] text-sand-100/60">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-400" />
              {order.customer_name} · {order.phone}
              <br />
              {/* Street address is intentionally not returned by the API — the
                  order number + phone already prove ownership, and this page is
                  reachable without a session. Area is enough to confirm. */}
              {order.upazila}, {order.district}, {order.division}
            </p>
          </div>

          {order.order_items?.length ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[11.5px] font-semibold text-sand-100/50">পণ্য</p>
              <ul className="space-y-1">
                {order.order_items.map((it) => (
                  <li key={`${it.name_bn}-${it.quantity}`} className="flex justify-between text-[12px] text-sand-100/70">
                    <span>{it.name_bn} × {it.quantity}</span>
                    <span>{money(Number(it.price) * it.quantity, true)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-center text-[10.5px] text-sand-100/35">
            স্টেটাস স্বয়ংক্রিয়ভাবে আপডেট হয় — পেজ রিফ্রেশ করে দেখুন।
          </p>
        </div>
      ) : null}
    </div>
  );
}
