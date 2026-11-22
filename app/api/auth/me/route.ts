import { currentUser, ok } from "@/lib/api";
import { getProfileByLegacyId } from "@/lib/profile";
import { getOrdersForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 * Returns the session user plus the richer Supabase profile (avatar, bio,
 * language, theme, onboarding flag) so the header dropdown and profile page
 * have everything in one round-trip.
 */
export async function GET() {
  const session = await currentUser();
  if (!session) return ok(null);

  const [orders, profile] = await Promise.all([
    getOrdersForUser(session.id).catch(() => []),
    getProfileByLegacyId(session.id).catch(() => null),
  ]);

  return ok({
    user: session,
    orderCount: orders.length,
    profile: profile
      ? {
          authId: profile.id,
          fullName: profile.full_name,
          phone: profile.phone,
          avatar: profile.avatar_url,
          bio: profile.bio,
          role: profile.role,
          language: profile.language,
          theme: profile.theme,
          notifications: profile.notifications,
          onboarded: profile.onboarded,
          mfa: profile.mfa_enrolled,
        }
      : null,
  });
}
