"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, Sparkles } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { money, todayISO } from "@/lib/format";
import { divisions, districtsOf, upazilasOf } from "@/lib/bd-locations";
import { Spinner } from "./ui";
import type { Package } from "@/lib/types";

const frequencies = [
  { value: "weekly", bn: "সাপ্তাহিক", en: "Weekly", hint: "সপ্তাহে ১ বার" },
  { value: "biweekly", bn: "পাক্ষিক", en: "Fortnightly", hint: "প্রতি ২ সপ্তাহে" },
  { value: "monthly", bn: "মাসিক", en: "Monthly", hint: "মাসে ১ বার" },
] as const;

export function SubscriptionForm({ packages }: { packages: Package[] }) {
  const { t, isBn } = useLocale();
  const toast = useToast();

  const [selected, setSelected] = useState(packages.find((p) => p.is_popular)?.id ?? packages[0]?.id ?? "");
  const [members, setMembers] = useState(4);
  const [startDate, setStartDate] = useState(todayISO());
  const [frequency, setFrequency] = useState<(typeof frequencies)[number]["value"]>("weekly");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [upazila, setUpazila] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ sub_no: string; package_name: string } | null>(null);

  const pkg = useMemo(() => packages.find((p) => p.id === selected), [packages, selected]);
  const districtList = useMemo(() => (division ? districtsOf(division) : []), [division]);
  const upazilaList = useMemo(() => (division && district ? upazilasOf(division, district) : []), [division, district]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_id: selected,
          customer_name: name,
          phone,
          division,
          district,
          upazila,
          address,
          members,
          start_date: startDate,
          frequency,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.errors) setErrors(json.errors);
        throw new Error(json.message ?? "সাবস্ক্রিপশন তৈরি করা যায়নি");
      }

      setSuccess({ sub_no: json.data.sub_no, package_name: json.data.package_name });
      toast.success(t("সাবস্ক্রিপশন চালু হয়েছে!", "Subscription created!"), json.data.sub_no);
    } catch (err) {
      toast.error(t("সমস্যা হয়েছে", "Something went wrong"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="card mx-auto mt-10 max-w-xl p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-leaf-600/20 text-2xl">🎉</span>
        <h2 className="mt-4 text-xl font-bold">অভিনন্দন! আপনার সাবস্ক্রিপশন চালু হয়েছে</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-sand-100/60">
          সাবস্ক্রিপশন নম্বর: <strong className="text-leaf-200">{success.sub_no}</strong>
          <br />
          প্যাকেজ: {success.package_name}
        </p>
        <p className="mt-3 text-[12.5px] text-sand-100/50">
          আমাদের প্রতিনিধি ২৪ ঘণ্টার মধ্যে কল করে পেমেন্ট ও প্রথম ডেলিভারি নিশ্চিত করবেন।
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/account/subscriptions" className="btn-primary">আমার সাবস্ক্রিপশন</Link>
          <Link href="/products" className="btn-ghost">আরও কিনুন</Link>
        </div>
      </div>
    );
  }

  return (
    <section className="section" aria-labelledby="pkg-select">
      <div className="mb-6 text-center">
        <h2 id="pkg-select" className="text-[22px] font-bold sm:text-3xl">১. প্যাকেজ বেছে নিন</h2>
        <p className="mt-1.5 text-[13px] text-sand-100/50">আপনার পরিবারের সদস্য সংখ্যা অনুযায়ী</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {packages.map((p) => {
          const active = p.id === selected;
          return (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p.id);
                setMembers(Math.round((p.members_min + p.members_max) / 2));
              }}
              className={`card relative flex flex-col p-5 text-left transition ${
                active
                  ? "border-neu-accent/40 bg-gradient-to-b from-neu-accent-soft to-neu-raised shadow-neu"
                  : "hover:border-white/20"
              }`}
              aria-pressed={active}
            >
              {p.is_popular ? (
                <span className="absolute -top-2.5 right-4 badge bg-leaf-400 text-ink-900">
                  <Sparkles className="h-3 w-3" /> জনপ্রিয়
                </span>
              ) : null}

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-leaf-300/80">
                  {p.members_label}
                </span>
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full border ${
                    active ? "border-leaf-400 bg-leaf-500 text-ink-900" : "border-white/25"
                  }`}
                >
                  {active ? <Check className="h-3 w-3" /> : null}
                </span>
              </div>

              <h3 className="mt-1.5 text-lg font-bold">{p.name_bn}</h3>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-leaf-200">{money(p.price_monthly, isBn)}</span>
                <span className="text-[11px] text-sand-100/45">/ মাস</span>
              </p>
              {p.saving_label ? <p className="mt-0.5 text-[11px] text-amber-300/90">{p.saving_label}</p> : null}

              <ul className="mt-3 space-y-1.5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex gap-1.5 text-[11.5px] leading-relaxed text-sand-100/60">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-leaf-400" /> {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* form */}
      <form onSubmit={submit} className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5 sm:p-6">
          <h2 className="text-[18px] font-bold">২. ডেলিভারি ও ব্যক্তিগত তথ্য</h2>
          <p className="mt-1 text-[12px] text-sand-100/50">সব তথ্য নিরাপদে সংরক্ষিত থাকে</p>

          <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">পুরো নাম *</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="যেমন: রফিকুল ইসলাম" />
              {errors.customer_name ? <span className="mt-1 block text-[11px] text-red-300">{errors.customer_name}</span> : null}
            </label>

            <label>
              <span className="label">মোবাইল নম্বর *</span>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                inputMode="tel"
                placeholder="01712345678"
              />
              {errors.phone ? <span className="mt-1 block text-[11px] text-red-300">{errors.phone}</span> : null}
            </label>

            <label>
              <span className="label">সদস্য সংখ্যা *</span>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={members}
                onChange={(e) => setMembers(Number(e.target.value))}
                className="input"
              />
              {errors.members ? <span className="mt-1 block text-[11px] text-red-300">{errors.members}</span> : null}
            </label>

            <label>
              <span className="label">বিভাগ *</span>
              <select
                required
                value={division}
                onChange={(e) => {
                  setDivision(e.target.value);
                  setDistrict("");
                  setUpazila("");
                }}
                className="input"
              >
                <option value="">নির্বাচন করুন</option>
                {Object.keys(divisions).map((d) => (
                  <option key={d} value={d} className="bg-ink-800">{d}</option>
                ))}
              </select>
              {errors.division ? <span className="mt-1 block text-[11px] text-red-300">{errors.division}</span> : null}
            </label>

            <label>
              <span className="label">জেলা *</span>
              <select
                required
                value={district}
                disabled={!division}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setUpazila("");
                }}
                className="input disabled:opacity-40"
              >
                <option value="">নির্বাচন করুন</option>
                {districtList.map((d) => (
                  <option key={d} value={d} className="bg-ink-800">{d}</option>
                ))}
              </select>
              {errors.district ? <span className="mt-1 block text-[11px] text-red-300">{errors.district}</span> : null}
            </label>

            <label>
              <span className="label">উপজেলা / থানা *</span>
              <select
                required
                value={upazila}
                disabled={!district}
                onChange={(e) => setUpazila(e.target.value)}
                className="input disabled:opacity-40"
              >
                <option value="">নির্বাচন করুন</option>
                {upazilaList.map((u) => (
                  <option key={u} value={u} className="bg-ink-800">{u}</option>
                ))}
              </select>
              {errors.upazila ? <span className="mt-1 block text-[11px] text-red-300">{errors.upazila}</span> : null}
            </label>

            <label className="sm:col-span-2">
              <span className="label">সম্পূর্ণ ঠিকানা *</span>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input resize-none"
                placeholder="বাসা / রোড / এলাকা / ল্যান্ডমার্ক"
              />
              {errors.address ? <span className="mt-1 block text-[11px] text-red-300">{errors.address}</span> : null}
            </label>

            <label>
              <span className="label">শুরুর তারিখ *</span>
              <input
                type="date"
                required
                min={todayISO()}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
              {errors.start_date ? <span className="mt-1 block text-[11px] text-red-300">{errors.start_date}</span> : null}
            </label>

            <label>
              <span className="label">ডেলিভারি ফ্রিকোয়েন্সি *</span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                className="input"
              >
                {frequencies.map((f) => (
                  <option key={f.value} value={f.value} className="bg-ink-800">
                    {t(f.bn, f.en)} — {f.hint}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="text-[15px] font-bold">সাবস্ক্রিপশন সারাংশ</h2>

            <dl className="mt-4 space-y-2.5 text-[12.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-sand-100/50">প্যাকেজ</dt>
                <dd className="text-right font-medium">{pkg?.name_bn ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-sand-100/50">সদস্য</dt>
                <dd className="font-medium">{members} জন</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-sand-100/50">ফ্রিকোয়েন্সি</dt>
                <dd className="font-medium">
                  {t(frequencies.find((f) => f.value === frequency)?.bn ?? "", frequencies.find((f) => f.value === frequency)?.en)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-sand-100/50">
                  <CalendarDays className="h-3.5 w-3.5" /> শুরু
                </dt>
                <dd className="font-medium">{startDate}</dd>
              </div>
            </dl>

            <div className="my-4 divider" />

            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">মাসিক মূল্য</span>
              <span className="text-xl font-bold text-leaf-200">{money(pkg?.price_monthly ?? 0, isBn)}</span>
            </div>
            <p className="mt-1 text-[10.5px] text-sand-100/40">
              ডেলিভারি চার্জ ফ্রি · যেকোনো সময় পজ/বাতিল
            </p>

            <button type="submit" disabled={loading || !selected} className="btn-primary mt-4 w-full">
              {loading ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
              {t("সাবস্ক্রিপশন শুরু করুন", "Start subscription")}
            </button>

            <p className="mt-3 text-center text-[10.5px] leading-relaxed text-sand-100/35">
              সাবস্ক্রাইব করলে আপনি আমাদের{" "}
              <Link href="/policies/terms" className="text-leaf-300 hover:underline">শর্তাবলী</Link> মেনে নিচ্ছেন।
            </p>
          </div>
        </aside>
      </form>
    </section>
  );
}
