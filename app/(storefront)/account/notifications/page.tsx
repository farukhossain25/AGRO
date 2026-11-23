import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { NotificationList } from "@/components/notification-list";
import { PushOptIn } from "@/components/push-opt-in";

export const dynamic = "force-dynamic";

export const metadata = { title: "নোটিফিকেশন", robots: { index: false } };

export default async function NotificationsPage() {
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login?next=/account/notifications");

  let items: Array<Record<string, unknown>> = [];
  try {
    const { data } = await db()
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("audience", "user")
      .order("created_at", { ascending: false })
      .limit(60);
    items = (data ?? []) as Array<Record<string, unknown>>;
  } catch {
    items = [];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-bold">নোটিফিকেশন</h1>
        <p className="mt-1 text-[12.5px] text-sand-100/50">অর্ডার, ডেলিভারি ও প্রিমিয়াম আপডেট</p>
      </div>

      <PushOptIn signedIn />

      <NotificationList
        initial={items.map((n) => ({
          id: String(n.id),
          kind: String(n.kind ?? "system"),
          title_bn: String(n.title_bn ?? ""),
          body_bn: n.body_bn ? String(n.body_bn) : null,
          link: n.link ? String(n.link) : null,
          is_read: Boolean(n.is_read),
          created_at: String(n.created_at ?? ""),
        }))}
      />
    </div>
  );
}
