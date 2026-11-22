import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { getProfileByLegacyId } from "@/lib/profile";
import { resolvePremiumState } from "@/lib/premium";
import { ProfileForm } from "@/components/account/profile-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "আমার প্রোফাইল",
  description: "প্রোফাইল, ঠিকানা, ভাষা ও নোটিফিকেশন সেটিংস ম্যানেজ করুন।",
  robots: { index: false, follow: false },
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account/profile");

  const [profile, premium, { welcome }] = await Promise.all([
    getProfileByLegacyId(user.id),
    resolvePremiumState(user.id, user.role).catch(() => null),
    searchParams,
  ]);

  return (
    <ProfileForm
      session={{ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role }}
      profile={profile}
      premium={
        premium
          ? {
              active: premium.canWatch,
              tier: premium.subscription?.tier ?? null,
              planName: premium.subscription?.plan_name_bn ?? null,
              expiresAt: premium.subscription?.expires_at ?? null,
              trialActive: premium.trial?.active ?? false,
              trialMinutes: premium.trial?.minutes ?? 0,
            }
          : null
      }
      showWelcome={welcome === "1"}
    />
  );
}
