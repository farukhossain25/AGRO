import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Banknote, Camera, TrendingUp } from "lucide-react";
import { currentUser } from "@/lib/api";
import { getSellerByUser } from "@/lib/sellers";
import { listFarms } from "@/lib/farms";
import { SellerApplyForm } from "@/components/seller/apply-form";
import { alternatesFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "বিক্রেতা হোন — বিশ্বাস এগ্রো মার্কেটপ্লেস",
  description: "আপনার খামারের পণ্য অনলাইনে বিক্রি করুন — লাইভ ক্যামেরা, QR ট্রেসেবিলিটি ও ১০% কমিশনে।",
  alternates: alternatesFor("/seller/apply"),
};

export default async function SellerApplyPage() {
  const user = await currentUser().catch(() => null);
  const existing = user ? await getSellerByUser(user.id).catch(() => null) : null;
  const farms = await listFarms({});

  return (
    <div className="container-x max-w-4xl py-10 sm:py-14">
      <header className="mb-8">
        <span className="eyebrow mb-3">সেলার প্রোগ্রাম</span>
        <h1 className="text-[26px] font-bold leading-tight sm:text-[34px]">আপনার খামার, আপনার স্টোর</h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-sand-100/60">
          বিশ্বাস এগ্রো মার্কেটপ্লেসে যোগ দিন — নিজের পণ্য নিজে যোগ করুন, দাম ঠিক করুন, আর গ্রাহক সরাসরি
          আপনার খামারের লাইভ ক্যামেরা দেখতে পারবে।
        </p>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Banknote, title: "১০% কমিশন", body: "প্রতি সপ্তাহে bKash/Nagad-এ পেমেন্ট" },
          { icon: Camera, title: "লাইভ ক্যামেরা", body: "গ্রাহকের আস্থা বাড়ায় সবচেয়ে বেশি" },
          { icon: TrendingUp, title: "নিজের ড্যাশবোর্ড", body: "অর্ডার, আয় ও স্টক এক জায়গায়" },
        ].map((b) => (
          <div key={b.title} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <b.icon className="h-4 w-4 text-mint" />
            <p className="mt-2 text-[12.5px] font-bold text-white">{b.title}</p>
            <p className="mt-0.5 text-[11px] text-sand-100/50">{b.body}</p>
          </div>
        ))}
      </div>

      {!user ? (
        <div className="card p-8 text-center">
          <BadgeCheck className="mx-auto h-8 w-8 text-mint/60" />
          <p className="mt-3 text-[14px] font-semibold text-white">আবেদন করতে লগইন করুন</p>
          <p className="mt-1 text-[12.5px] text-sand-100/50">ফোন OTP দিয়ে ৩০ সেকেন্ডে লগইন</p>
          <Link href="/login?next=/seller/apply" className="btn-primary btn-sm mt-4">
            লগইন / রেজিস্টার
          </Link>
        </div>
      ) : existing && existing.status === "rejected" ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-[12.5px] text-red-200">
          আপনার আগের আবেদন বাতিল হয়েছে
          {existing.rejection_reason ? `: ${existing.rejection_reason}` : "."} নিচে তথ্য সংশোধন করে আবার জমা দিন।
        </div>
      ) : existing ? (
        <div className="card p-8 text-center">
          <p className="text-2xl">{existing.status === "approved" ? "🎉" : "⏳"}</p>
          <p className="mt-2 text-[14px] font-semibold text-white">
            {existing.status === "approved" ? "আপনি অনুমোদিত বিক্রেতা" : "আপনার আবেদন যাচাই চলছে"}
          </p>
          <p className="mt-1 text-[12.5px] text-sand-100/50">
            {existing.status === "approved"
              ? "এখন পণ্য যোগ করে বিক্রি শুরু করুন।"
              : "সাধারণত ২৪–৪৮ ঘণ্টার মধ্যে অনুমোদন হয়।"}
          </p>
          <Link href="/seller" className="btn-primary btn-sm mt-4">
            সেলার ড্যাশবোর্ড
          </Link>
        </div>
      ) : (
        <SellerApplyForm
          defaultPhone={user.phone ?? ""}
          defaultEmail={user.email ?? ""}
          farms={farms.map((f) => ({ id: f.id, name_bn: f.name_bn, district: f.district }))}
        />
      )}

      <p className="mt-8 text-center text-[11.5px] text-sand-100/35">
        শর্তাবলি পড়ুন —{" "}
        <Link href="/policies/terms" className="text-mint hover:underline">
          সেলার চুক্তি ও পেমেন্ট শর্ত
        </Link>
      </p>
    </div>
  );
}
