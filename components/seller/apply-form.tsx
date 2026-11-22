"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/lib/toast";
import { divisions as DIVISION_MAP, divisionNames } from "@/lib/bd-locations";

const PRODUCT_TYPES = [
  { id: "vegetables", label: "শাকসবজি" },
  { id: "fruits", label: "ফল" },
  { id: "dairy", label: "দুধ ও দুগ্ধ" },
  { id: "poultry", label: "মুরগি ও ডিম" },
  { id: "fish", label: "মাছ" },
  { id: "rice", label: "চাল, ডাল, তেল" },
  { id: "honey", label: "মধু ও অর্গানিক" },
  { id: "spices", label: "মসলা" },
  { id: "agri", label: "কৃষি উপকরণ" },
];

export function SellerApplyForm({
  defaultPhone,
  defaultEmail,
  farms,
}: {
  defaultPhone: string;
  defaultEmail: string;
  farms: { id: string; name_bn: string; district: string }[];
}) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [division, setDivision] = useState("ঢাকা");
  const [types, setTypes] = useState<string[]>([]);
  const [payoutMethod, setPayoutMethod] = useState<"bkash" | "nagad" | "bank">("bkash");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const districts = Object.keys(DIVISION_MAP[division] ?? {});

  const toggleType = (id: string) =>
    setTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    if (!types.length) {
      setErrors({ product_types: "কমপক্ষে একটি পণ্যের ধরন বেছে নিন" });
      return;
    }
    setErrors({});
    setSaving(true);

    try {
      const res = await fetch("/api/sellers/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name_bn: form.get("name_bn"),
          phone: form.get("phone"),
          email: form.get("email") || "",
          nid: form.get("nid") || "",
          farm_address_bn: form.get("farm_address_bn"),
          division: form.get("division"),
          district: form.get("district"),
          product_types: types,
          payout_method: payoutMethod,
          payout_number: form.get("payout_number"),
          bank_name: form.get("bank_name") || "",
          bank_account: form.get("bank_account") || "",
          farm_id: form.get("farm_id") || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        if (json?.errors) setErrors(json.errors);
        errorToast("আবেদন জমা হয়নি", json?.message);
        return;
      }

      success("আবেদন জমা হয়েছে", "২৪–৪৮ ঘণ্টার মধ্যে যাচাই করে জানানো হবে");
      router.push("/seller");
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name_bn">খামার / ব্যবসার নাম *</label>
          <input id="name_bn" name="name_bn" required className="input" placeholder="যেমন: সাভার গ্রিনস খামার" />
          <FieldError message={errors.name_bn} />
        </div>

        <div>
          <label className="label" htmlFor="phone">মোবাইল নম্বর *</label>
          <input id="phone" name="phone" required defaultValue={defaultPhone} className="input" placeholder="017XXXXXXXX" />
          <FieldError message={errors.phone} />
        </div>

        <div>
          <label className="label" htmlFor="email">ইমেইল (ঐচ্ছিক)</label>
          <input id="email" name="email" type="email" defaultValue={defaultEmail} className="input" />
          <FieldError message={errors.email} />
        </div>

        <div>
          <label className="label" htmlFor="nid">জাতীয় পরিচয়পত্র নম্বর</label>
          <input id="nid" name="nid" className="input" placeholder="১০–১৭ ডিজিট" inputMode="numeric" />
          <FieldError message={errors.nid} />
        </div>

        <div>
          <label className="label" htmlFor="farm_id">কোন খামারের সাথে যুক্ত? (ঐচ্ছিক)</label>
          <select id="farm_id" name="farm_id" className="input">
            <option value="">— নেই, নতুন খামার —</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name_bn} ({f.district})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="division">বিভাগ *</label>
          <select
            id="division"
            name="division"
            className="input"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            {divisionNames.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="district">জেলা *</label>
          <select id="district" name="district" className="input" required>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="farm_address_bn">খামারের ঠিকানা *</label>
          <textarea
            id="farm_address_bn"
            name="farm_address_bn"
            required
            rows={2}
            className="input"
            placeholder="গ্রাম, ইউনিয়ন, উপজেলা — বিস্তারিত"
          />
          <FieldError message={errors.farm_address_bn} />
        </div>

        <div className="sm:col-span-2">
          <span className="label">কী ধরনের পণ্য বিক্রি করবেন? *</span>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleType(t.id)}
                className={`chip ${types.includes(t.id) ? "chip-active" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <FieldError message={errors.product_types} />
        </div>

        <div className="sm:col-span-2">
          <span className="label">পেমেন্ট কীভাবে নিতে চান?</span>
          <div className="flex gap-2">
            {(["bkash", "nagad", "bank"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPayoutMethod(m)}
                className={`chip ${payoutMethod === m ? "chip-active" : ""}`}
              >
                {m === "bkash" ? "bKash" : m === "nagad" ? "Nagad" : "ব্যাংক"}
              </button>
            ))}
          </div>
        </div>

        {payoutMethod === "bank" ? (
          <>
            <div>
              <label className="label" htmlFor="bank_name">ব্যাংকের নাম *</label>
              <input id="bank_name" name="bank_name" className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="bank_account">হিসাব নম্বর *</label>
              <input id="bank_account" name="bank_account" className="input" required inputMode="numeric" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="payout_number">মোবাইল নম্বর (যোগাযোগ) *</label>
              <input id="payout_number" name="payout_number" className="input" required inputMode="tel" />
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="payout_number">
              {payoutMethod === "bkash" ? "bKash" : "Nagad"} নম্বর *
            </label>
            <input
              id="payout_number"
              name="payout_number"
              className="input"
              required
              inputMode="tel"
              placeholder="017XXXXXXXX"
            />
            <FieldError message={errors.payout_number} />
          </div>
        )}
      </div>

      <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-sand-100/45">
        আবেদন জমা দিয়ে আপনি সম্মত হচ্ছেন বিশ্বাস এগ্রোর সেলার শর্তাবলি ও ১০% কমিশন কাঠামোতে। যাচাইয়ের জন্য
        আমাদের টিম প্রয়োজনে কল করতে পারে।
      </p>

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {saving ? "জমা হচ্ছে…" : "আবেদন জমা দিন"}
      </button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-red-300">{message}</p>;
}
