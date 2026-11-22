import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { getProfileByLegacyId } from "@/lib/profile";
import { SecurityPanel } from "@/components/account/security-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "নিরাপত্তা ও ২FA",
  robots: { index: false, follow: false },
};

export default async function SecurityPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account/security");

  const profile = await getProfileByLegacyId(user.id);
  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[16px] font-bold">নিরাপত্তা</h2>
        <p className="mt-1 text-[12px] text-sand-100/50">
          পাসওয়ার্ড, টু-স্টেপ যাচাই (2FA) ও অ্যাক্টিভ সেশন ম্যানেজ করুন।
        </p>
      </div>

      <SecurityPanel isAdmin={isAdmin} mfaEnrolled={profile?.mfa_enrolled ?? false} />
    </div>
  );
}
