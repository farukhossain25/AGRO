import { db, isDbConfigured } from "@/lib/db";
import { SettingsManager } from "@/components/admin/settings-manager";
import { AnnouncementEditor } from "@/components/admin/announcement-editor";

export const dynamic = "force-dynamic";

/* /foisal/settings — সাইট সেটিংস
   --------------------------------------------------------------------------
   Reads the eight JSON objects in `settings` and hands them to the typed form.
   This screen exists so the owner never needs psql for the numbers that move
   money (delivery, commission) or open a door (lockout, 2FA, auto-approve). */
export default async function AdminSettingsPage() {
  const settings: Record<string, Record<string, unknown>> = {};
  let dbReady = isDbConfigured();

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("site_settings").select("key, value").order("key");
      for (const row of data ?? []) {
        settings[row.key as string] = (row.value ?? {}) as Record<string, unknown>;
      }
    } catch {
      dbReady = false;
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[20px] font-bold sm:text-2xl">সাইট সেটিংস</h1>
        <p className="mt-1 text-[12.5px] text-sand-100/50">
          ডেলিভারি চার্জ, কমিশন, ট্রায়াল, জালিয়াতি রোধ ও লগইন নিরাপত্তা — কোড না ছুঁয়েই।
        </p>
      </header>

      {!dbReady ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-[12px] text-red-200/80">
          ডেটাবেজে সংযোগ হচ্ছে না — এখন সেভ করলে কাজ হবে না। কিছুক্ষণ পর আবার চেষ্টা করুন।
        </div>
      ) : null}

      <AnnouncementEditor initial={settings.announcement} />

      <SettingsManager initial={settings} />
    </div>
  );
}
