import type { Metadata } from "next";
import { TrackForm } from "@/components/track-form";
import { PackageSearch, Phone } from "lucide-react";
import { defaultStoreSettings, getStoreSettings } from "@/lib/site-settings";
import { alternatesFor } from "@/lib/seo";

export const metadata: Metadata = {
  title: "অর্ডার ট্র্যাকিং",
  description: "অর্ডার নম্বর ও মোবাইল নম্বর দিয়ে আপনার বিশ্বাস এগ্রো অর্ডারের সর্বশেষ অবস্থা জানুন।",
  alternates: alternatesFor("/track"),
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const store = await getStoreSettings().catch(() => defaultStoreSettings);

  return (
    <div className="container-x py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-leaf-600/15">
            <PackageSearch className="h-7 w-7 text-leaf-300" />
          </span>
          <h1 className="mt-4 text-[26px] font-bold sm:text-3xl">অর্ডার ট্র্যাক করুন</h1>
          <p className="mx-auto mt-2 max-w-lg text-[13.5px] leading-relaxed text-sand-100/55">
            আপনার অর্ডার নম্বর ও যেই মোবাইল নম্বর দিয়ে অর্ডার করেছিলেন সেটি দিন।
            অর্ডার নম্বর পেয়েছেন এসএমএসে অথবা অর্ডার কনফার্মেশন পেজে।
          </p>
        </div>

        <div className="mt-7">
          <TrackForm initialOrder={order ?? ""} />
        </div>

        <div className="mt-8 card p-5">
          <h2 className="text-[14px] font-semibold">সাহায্য দরকার?</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/55">
            অর্ডার নম্বর হারিয়ে গেলে বা কোনো সমস্যা হলে সরাসরি কল করুন —{" "}
            <a href={`tel:${store.phone}`} className="inline-flex items-center gap-1 font-semibold text-leaf-300">
              <Phone className="h-3.5 w-3.5" /> {store.phone_display}
            </a>
          </p>
          <p className="mt-1 text-[11.5px] text-sand-100/40">{store.hours_bn}</p>
        </div>
      </div>
    </div>
  );
}
