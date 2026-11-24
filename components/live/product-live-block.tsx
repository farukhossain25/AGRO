"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Camera, Lock, Radio, VideoOff, WifiOff } from "lucide-react";
import { LiveStream } from "@/components/live/live-stream";
import { useLocale } from "@/lib/locale";
import { formatDateTimeBn } from "@/lib/format";

/* ==========================================================================
   ProductLiveBlock — live footage under the supplier card (section D)
   --------------------------------------------------------------------------
   Five states, decided server-side where possible:

     anonymous        → "লাইভ দেখতে লগইন করুন"
     no camera        → "এই খামারে এখনো ক্যামেরা নেই"
     camera offline   → "ক্যামেরা অফলাইন" + last seen
     not premium      → blurred preview + lock + "প্রিমিয়াম কিনে লাইভ দেখুন"
     premium / trial  → LiveStream with a camera switcher

   The token endpoint re-checks entitlement on every play, so this component
   only decides what to *show*; it never grants access by itself.
   ========================================================================== */

export type LiveCamera = {
  id: string;
  nameBn: string;
  zoneBn: string | null;
  status: string;
  poster: string | null;
  lastHeartbeat: string | null;
};

export type ProductLiveBlockProps = {
  cameras: LiveCamera[];
  farmSlug: string | null;
  farmName: string | null;
  poster: string | null;
  /** server-resolved: is there a usable session? */
  loggedIn: boolean;
  /** server-resolved: active subscription or live trial */
  canWatch: boolean;
  reason: "premium" | "trial" | "locked" | "anonymous";
};

export function ProductLiveBlock({
  cameras,
  farmSlug,
  farmName,
  poster,
  loggedIn,
  canWatch,
  reason,
}: ProductLiveBlockProps) {
  const { t } = useLocale();

  const online = cameras.filter((c) => c.status === "online");
  const [activeId, setActiveId] = useState<string | null>(online[0]?.id ?? cameras[0]?.id ?? null);
  const active = cameras.find((c) => c.id === activeId) ?? cameras[0] ?? null;

  /* ------------------------------------------------------- no camera at all */
  if (!cameras.length) {
    return (
      <StateCard
        icon={<VideoOff className="h-5 w-5" />}
        title={t("এই খামারে এখনো ক্যামেরা নেই", "No camera on this farm yet")}
        body={t(
          "খামারটি লাইভ ক্যামেরা যোগ করলে এখানেই সরাসরি দেখতে পাবেন।",
          "Once the farm installs a live camera you can watch it right here."
        )}
        action={
          farmSlug ? (
            <Link href={`/live/farms/${farmSlug}`} className="btn-ghost !px-3 !py-1.5 !text-[12px]">
              {t("খামার প্রোফাইল দেখুন", "View farm profile")}
            </Link>
          ) : null
        }
      />
    );
  }

  /* ---------------------------------------------------------- not logged in */
  if (!loggedIn) {
    return (
      <StateCard
        tone="locked"
        poster={poster ?? active?.poster}
        icon={<Lock className="h-5 w-5" />}
        title={t("লাইভ দেখতে লগইন করুন", "Sign in to watch live")}
        body={t(
          "লগইন করে ১০ মিনিট ফ্রি ট্রায়াল নিন অথবা প্রিমিয়াম প্ল্যান কিনুন।",
          "Sign in for a 10-minute free trial or buy a premium plan."
        )}
        action={
          <>
            <Link
              href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/products")}`}
              className="btn-primary !px-4 !py-1.5 !text-[12px]"
            >
              {t("লগইন করুন", "Sign in")}
            </Link>
            <Link href="/live/plans" className="btn-ghost !px-4 !py-1.5 !text-[12px]">
              {t("প্রিমিয়াম প্ল্যান", "Premium plans")}
            </Link>
          </>
        }
      />
    );
  }

  /* ---------------------------------------------------------- not entitled */
  if (!canWatch) {
    return (
      <section aria-labelledby="live-heading" className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3 sm:px-5">
          <h2 id="live-heading" className="flex items-center gap-2 text-[14px] font-bold">
            <Radio className="h-4 w-4 text-red-400" />
            {t("লাইভ ফুটেজ", "Live footage")}
          </h2>
          <span className="text-[10.5px] text-white/35">{farmName}</span>
        </div>

        <div className="p-3 sm:p-4">
          <div className="relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
            {poster ?? active?.poster ? (
              <Image
                src={(poster ?? active?.poster) as string}
                alt={t("ব্লার করা প্রিভিউ", "Blurred preview")}
                width={800}
                height={450}
                className="aspect-video w-full scale-105 object-cover blur-md brightness-[0.45]"
                unoptimized
              />
            ) : (
              <div className="aspect-video w-full bg-gradient-to-br from-leaf-900/60 via-scrim to-scrim" />
            )}

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur">
                <Lock className="h-5 w-5" />
              </span>
              <p className="text-[13.5px] font-bold text-white">
                {reason === "anonymous"
                  ? t("লাইভ দেখতে লগইন করুন", "Sign in to watch live")
                  : t("প্রিমিয়াম কিনে লাইভ দেখুন", "Go premium to watch live")}
              </p>
              <p className="max-w-[280px] text-[11.5px] leading-relaxed text-white/65">
                {t(
                  "খামারের ক্যামেরা থেকে সরাসরি সম্প্রচার — পণ্য কীভাবে জন্মায় ও সংরক্ষণ হয় নিজেই দেখুন।",
                  "Watch the farm camera live — see exactly how your food is grown and stored."
                )}
              </p>
              <Link
                href="/live/plans"
                className="mt-1 rounded-full bg-mint px-5 py-2 text-[12px] font-bold text-green-900 transition hover:bg-mint/90"
              >
                {t("প্রিমিয়াম কিনে লাইভ দেখুন", "Go premium to watch")}
              </Link>
              <Link href="/live/trial" className="text-[11px] font-semibold text-white/70 hover:text-white">
                {t("অথবা ১০ মিনিট ফ্রি ট্রায়াল →", "Or start a 10-minute free trial →")}
              </Link>
            </div>
          </div>

          <p className="mt-2 text-center text-[10.5px] text-white/35">
            {t(
              `${online.length}টি ক্যামেরা এই খামারে লাইভ আছে`,
              `${online.length} camera(s) live on this farm`
            )}
          </p>
        </div>
      </section>
    );
  }

  /* --------------------------------------------------------------- entitled */
  return (
    <section aria-labelledby="live-heading" className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3 sm:px-5">
        <h2 id="live-heading" className="flex items-center gap-2 text-[14px] font-bold">
          <Radio className="h-4 w-4 text-red-400" />
          {t("লাইভ ফুটেজ", "Live footage")}
          <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-red-300">
            {reason === "trial" ? t("ট্রায়াল", "Trial") : t("লাইভ", "Live")}
          </span>
        </h2>
        <span className="text-[10.5px] text-white/35">{farmName}</span>
      </div>

      <div className="p-3 sm:p-4">
        {active ? (
          active.status === "online" ? (
            <LiveStream
              key={active.id}
              cameraId={active.id}
              cameraName={`${farmName ?? ""} · ${active.nameBn}`}
              poster={active.poster}
            />
          ) : (
            <StateCard
              embedded
              icon={<WifiOff className="h-5 w-5" />}
              title={t("ক্যামেরা অফলাইন", "Camera offline")}
              body={
                active.lastHeartbeat
                  ? t(
                      `সর্বশেষ সংযুক্ত ছিল ${formatDateTimeBn(active.lastHeartbeat)}`,
                      `Last seen ${formatDateTimeBn(active.lastHeartbeat)}`
                    )
                  : t("ক্যামেরাটি এখন বন্ধ আছে", "This camera is currently off")
              }
              action={
                online.length ? (
                  <button
                    onClick={() => setActiveId(online[0].id)}
                    className="btn-ghost !px-3 !py-1.5 !text-[12px]"
                  >
                    {t("চালু ক্যামেরা দেখুন", "Watch an online camera")}
                  </button>
                ) : null
              }
            />
          )
        ) : null}

        {/* camera switcher */}
        {cameras.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {cameras.map((cam) => {
              const isActive = cam.id === active?.id;
              const isOnline = cam.status === "online";
              return (
                <button
                  key={cam.id}
                  onClick={() => setActiveId(cam.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11.5px] font-medium transition ${
                    isActive
                      ? "border-leaf-500 bg-leaf-600/20 text-leaf-100"
                      : "border-white/10 text-white/60 hover:border-white/25"
                  }`}
                  aria-pressed={isActive}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isOnline ? "bg-red-500" : "bg-sand-100/25"
                    }`}
                  />
                  {cam.nameBn}
                  {cam.zoneBn ? (
                    <span className="text-[9.5px] text-white/35">· {cam.zoneBn}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between">
          <p className="inline-flex items-center gap-1 text-[10.5px] text-white/35">
            <Camera className="h-3 w-3" />
            {t("৫ মিনিটের নিরাপদ স্ট্রিম টোকেন", "5-minute signed stream token")}
          </p>
          <Link href="/live/plans" className="text-[10.5px] text-leaf-300 hover:underline">
            {t("প্ল্যান ম্যানেজ করুন", "Manage plan")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ building blocks */
function StateCard({
  icon,
  title,
  body,
  action,
  poster,
  tone,
  embedded = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  poster?: string | null;
  tone?: "locked";
  embedded?: boolean;
}) {
  const inner = (
    <div
      className={
        embedded
          ? "relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
          : "relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-850 to-ink-900 ring-1 ring-white/[0.07]"
      }
    >
      {poster ? (
        <Image
          src={poster}
          alt=""
          width={800}
          height={450}
          className="aspect-video w-full object-cover opacity-40 blur-sm"
          unoptimized
        />
      ) : (
        <div className="aspect-video w-full bg-gradient-to-br from-leaf-900/40 via-scrim to-scrim" />
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <span
          className={`grid h-11 w-11 place-items-center rounded-full ${
            tone === "locked"
              ? "bg-black/55 text-white ring-1 ring-white/20"
              : "bg-white/[0.06] text-white/70 ring-1 ring-white/10"
          }`}
        >
          {icon}
        </span>
        <p className="text-[13px] font-bold text-white/90">{title}</p>
        <p className="max-w-[300px] text-[11.5px] leading-relaxed text-white/55">{body}</p>
        {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
      </div>
    </div>
  );

  if (embedded) return inner;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-white/[0.07] px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-[14px] font-bold">
          <Radio className="h-4 w-4 text-white/40" />
          লাইভ ফুটেজ
        </h2>
      </div>
      <div className="p-3 sm:p-4">{inner}</div>
    </section>
  );
}
