import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { SecurityPanel } from "@/components/account/security-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "নিরাপত্তা ও সেটিংস",
  robots: { index: false, follow: false },
};

export default async function SecurityPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account/security");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[16px] font-bold">নিরাপত্তা ও সেটিংস</h2>
        <p className="mt-1 text-[12px] text-sand-100/50">পাসওয়ার্ড বদলান ও সব ডিভাইস থেকে লগআউট করুন।</p>
      </div>

      <SecurityPanel email={user.email} />
    </div>
  );
}
