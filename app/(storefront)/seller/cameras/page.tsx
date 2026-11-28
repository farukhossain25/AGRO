import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Camera, CheckCircle2, Clock, PhoneCall, Video, XCircle } from "lucide-react";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { getSellerByUser } from "@/lib/sellers";
import { ensureSellerFarm } from "@/lib/seller-farm";
import { toBn } from "@/lib/format";
import { CameraRequestForm } from "@/components/seller/camera-request-form";
import { ChannelForm } from "@/components/seller/channel-form";
import { ChannelList } from "@/components/seller/channel-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "লাইভ ক্যামেরা রিকোয়েস্ট",
  robots: { index: false, follow: false },
};

/* The statuses camera_requests.status allows in the database
   (pending | contacted | scheduled | installed | cancelled). `approved` /
   `rejected` stay as labels for rows written before the panel matched the
   constraint. */
const STATUS = {
  pending: { label: "অনুমোদনের অপেক্ষায়", tone: "text-amber-300", icon: Clock },
  contacted: { label: "টিম যোগাযোগ করেছে", tone: "text-sky-300", icon: PhoneCall },
  scheduled: { label: "অনুমোদিত — ইনস্টলের দিন নির্ধারিত", tone: "text-sky-300", icon: CalendarClock },
  approved: { label: "অনুমোদিত — ইনস্টলেশন চলবে", tone: "text-sky-300", icon: Camera },
  installed: { label: "ইনস্টল সম্পন্ন — লাইভ চলছে", tone: "text-leaf-200", icon: CheckCircle2 },
  rejected: { label: "বাতিল", tone: "text-red-300", icon: XCircle },
  cancelled: { label: "বাতিল", tone: "text-red-300", icon: XCircle },
} as const;

export default async function SellerCamerasPage() {
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login?next=/seller/cameras");

  const seller = await getSellerByUser(user.id).catch(() => null);
  if (!seller) redirect("/seller/apply");

  // An approved seller always has a farm to hang cameras on.
  const farm = seller.status === "approved" ? await ensureSellerFarm(seller).catch(() => null) : null;

  const [{ data: requests }, { data: cameraRows }] = await Promise.all([
    db()
      .from("camera_requests")
      .select("*")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false }),
    farm
      ? db()
          .from("cameras")
          .select("id, name_bn, zone_bn, status, stream_key, cloud_provider, stream_url")
          .eq("farm_id", farm.id)
          .eq("is_active", true)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const channels = (cameraRows ?? [])
    .filter((c) => c.cloud_provider === "tv")
    .map((c) => ({ id: c.id, name_bn: c.name_bn, status: c.status, stream_url: c.stream_url }));

  const mine = farm
    ? {
        ...farm,
        camera_count: cameraRows?.length ?? 0,
        online_cameras: cameraRows?.filter((c) => c.status === "online").length ?? 0,
      }
    : null;

  return (
    <div className="container-x max-w-2xl py-10 sm:py-14">
      <nav className="mb-5 flex items-center gap-1.5 text-[12px] text-sand-100/40">
        <Link href="/seller" className="hover:text-mint">সেলার ড্যাশবোর্ড</Link>
        <span>/</span>
        <span className="text-sand-100/70">ক্যামেরা</span>
      </nav>

      <header className="mb-6">
        <span className="eyebrow mb-3">
          <Video className="h-3.5 w-3.5" /> লাইভ ক্যামেরা
        </span>
        <h1 className="text-[24px] font-bold leading-tight sm:text-[30px]">আপনার খামারে ক্যামেরা বসান</h1>
        <p className="mt-2.5 text-[13px] leading-relaxed text-sand-100/60">
          গ্রাহক যখন নিজের চোখে দেখতে পারেন খামার ও প্যাকিং কেমন চলছে, তখন আস্থা তৈরি হয় — আর আস্থা মানেই
          পুনরায় অর্ডার।
        </p>
      </header>

      {mine && (
        <div className="mb-5 rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wide text-sand-100/40">যুক্ত খামার</p>
          <p className="mt-0.5 text-[14px] font-semibold text-neu-ink">{mine.name_bn}</p>
          <p className="text-[11.5px] text-sand-100/45">
            {toBn(mine.camera_count)}টি ক্যামেরা · {toBn(mine.online_cameras)}টি অনলাইন
          </p>
          <Link href={`/live/farms/${mine.slug}`} className="mt-2 inline-block text-[11.5px] text-mint hover:underline">
            লাইভ পেজ দেখুন →
          </Link>
        </div>
      )}

      {/* Channels first: they are the live video a seller can publish TODAY,
          with no public IP and no installation visit. The camera request below
          stays exactly as it was, for when the hardware path is ready. */}
      {farm && <ChannelList channels={channels} farmSlug={mine?.slug ?? null} />}
      <ChannelForm disabled={!farm} />

      <CameraRequestForm hasFarm={Boolean(farm)} />

      {(requests ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[14px] font-bold text-neu-ink">আগের রিকোয়েস্ট</h2>
          <ul className="space-y-2">
            {(requests ?? []).map((r) => {
              const meta = STATUS[r.status as keyof typeof STATUS] ?? STATUS.pending;
              const Icon = meta.icon;
              return (
                <li key={r.id} className="card flex items-start gap-3 p-3.5">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tone}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12.5px] font-semibold ${meta.tone}`}>{meta.label}</p>
                    <p className="mt-0.5 text-[11.5px] text-sand-100/55">
                      {toBn(Number(r.camera_count ?? 0))}টি ক্যামেরা
                      {r.note_bn ? ` · ${r.note_bn}` : ""}
                    </p>
                    {r.admin_note && (
                      <p className="mt-1 rounded bg-white/[0.03] px-2 py-1 text-[11px] text-sand-100/50">
                        অ্যাডমিন: {r.admin_note}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-sand-100/30">
                      {new Date(r.created_at).toLocaleDateString("bn-BD")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-8 rounded-xl border border-mint/20 bg-leaf-900/20 p-4">
        <p className="text-[12.5px] font-bold text-neu-ink">ক্যামেরা সম্পর্কে</p>
        <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-sand-100/55">
          <li>• ইনস্টলেশন ও যন্ত্রপাতি বিশ্বাস এগ্রো বহন করে — আপনার কোনো খরচ নেই।</li>
          <li>• শুধু খামার ও প্যাকিং এলাকার ক্যামেরা অনুমোদিত, ব্যক্তিগত স্থান নয়।</li>
          <li>• স্ট্রিম সোর্স গোপন থাকে — গ্রাহক শুধু স্বাক্ষরিত টোকেন দিয়ে দেখতে পারেন।</li>
        </ul>
      </div>
    </div>
  );
}
