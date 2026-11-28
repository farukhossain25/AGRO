"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamMode } from "@/lib/stream-mode";

/* ==========================================================================
   CloudPlayer — plays a camera that lives behind a vendor cloud
   --------------------------------------------------------------------------
   Talks to /api/cam/token, then feeds the returned same-origin playlist to
   hls.js (or the browser's own HLS on iOS). The vendor URL, the device serial
   and the API credentials never appear in this file or in the page source.

   Designed to look exactly like <LiveStream> so a page can swap one for the
   other without a layout change.
   ========================================================================== */

type Props = {
  cameraId: string;
  cameraName: string;
  poster?: string | null;
  autoPlay?: boolean;
  compact?: boolean;
  className?: string;
  onMode?: (mode: StreamMode) => void;
};

type Token = { url: string; expiresIn: number; mode: "premium" | "trial" | "public" };

export function CloudPlayer({
  cameraId,
  cameraName,
  poster,
  autoPlay = true,
  compact = false,
  className = "",
  onMode,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gone = useRef(false);

  const [status, setStatus] = useState<"loading" | "playing" | "locked" | "offline" | "error">("loading");
  /**
   * Retries are BOUNDED.
   *
   * The network-error handler used to re-attach every 5 s, for ever. On a
   * channel that is genuinely dead — or, as it turned out, on a playlist that
   * was actually a channel LIST the player could not parse — that produced no
   * error at all: just "লাইভ লোড হচ্ছে…" and a request every few seconds until
   * the visitor gave up. Three attempts, then say so and offer the button.
   */
  const retries = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const [message, setMessage] = useState("লাইভ লোড হচ্ছে…");

  const teardown = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const attach = useCallback(
    async (isRefresh = false) => {
      if (gone.current) return;

      try {
        if (!isRefresh) retries.current = 0;
        const res = await fetch("/api/cam/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cameraId }),
        });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          const locked = res.status === 402 || res.status === 403;
          setStatus(locked ? "locked" : res.status === 409 || res.status === 404 ? "offline" : "error");
          setMessage(json?.message ?? "ক্যামেরা চালু করা যাচ্ছে না");
          onMode?.("locked");
          return;
        }

        const data = json.data as Token;
        onMode?.(data.mode);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => attach(true), Math.max(120_000, data.expiresIn * 800));

        const video = videoRef.current;
        if (!video) return;

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // iOS / Safari — native HLS, no download at all
          video.src = data.url;
          video.addEventListener("loadedmetadata", () => {
            setStatus("playing");
            setMessage("");
            if (autoPlay) video.play().catch(() => {});
          });
          return;
        }

        const HlsLib = (await import("hls.js")).default;
        if (!HlsLib.isSupported()) {
          setStatus("error");
          setMessage("এই ব্রাউজারে লাইভ চালানো যাচ্ছে না");
          return;
        }

        if (!hlsRef.current) {
          const hls = new HlsLib({
            lowLatencyMode: true,
            liveSyncDurationCount: 3,
            manifestLoadingMaxRetry: 4,
            fragLoadingMaxRetry: 6,
          });
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
            setStatus("playing");
            setMessage("");
            if (autoPlay) video.play().catch(() => {});
          });
          hls.on(HlsLib.Events.ERROR, (_e: unknown, payload: { fatal: boolean; type: string }) => {
            if (!payload.fatal) return;
            if (payload.type === HlsLib.ErrorTypes.NETWORK_ERROR) {
              retries.current += 1;
              if (retries.current > 3) {
                setStatus("offline");
                setMessage("চ্যানেলটি এখন পাওয়া যাচ্ছে না — লিংকটি হয়তো আর চালু নেই");
                teardown();
                return;
              }
              setStatus("offline");
              setMessage("সংযোগ বিচ্ছিন্ন — আবার চেষ্টা করছি…");
              setTimeout(() => attach(true), 5000);
            } else {
              setStatus("error");
              setMessage("স্ট্রিম চালু করা যাচ্ছে না");
              hls.destroy();
              hlsRef.current = null;
            }
          });
        }

        hlsRef.current.loadSource(data.url);
        if (!isRefresh) setStatus((s) => (s === "playing" ? s : "loading"));
      } catch {
        setStatus("error");
        setMessage("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
      }
    },
    [cameraId, autoPlay, onMode, teardown]
  );

  useEffect(() => {
    gone.current = false;
    attach();
    return () => {
      gone.current = true;
      teardown();
    };
  }, [attach, teardown]);

  /** Pause when scrolled out of view — saves mobile data and battery. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (autoPlay && video.paused && statusRef.current === "playing") video.play().catch(() => {});
          } else if (!video.paused) {
            video.pause();
          }
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [autoPlay]);

  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 ${className}`}>
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        muted
        playsInline
        controls={status === "playing"}
        className="aspect-video h-full w-full object-cover"
      />

      {status === "playing" && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-white">লাইভ</span>
        </div>
      )}

      {status !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-black/70 via-black/80 to-black/90 px-6 text-center">
          {status === "locked" ? (
            <div className="space-y-3">
              <span className="text-2xl">🔒</span>
              <p className="text-sm font-medium text-white/90">{message}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a
                  href="/live/trial"
                  className="rounded-full bg-mint px-4 py-1.5 text-xs font-bold text-green-900 transition hover:bg-mint/90"
                >
                  ১০ মিনিট ফ্রি দেখুন
                </a>
                <a
                  href="/live/plans"
                  className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25"
                >
                  প্রিমিয়াম প্ল্যান
                </a>
              </div>
            </div>
          ) : status === "loading" ? (
            <>
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
              <p className="text-xs text-white/70">{message}</p>
            </>
          ) : (
            <>
              <span className="text-2xl">{status === "offline" ? "📡" : "⚠️"}</span>
              <p className="text-sm font-medium text-white/90">{message}</p>
              <button
                type="button"
                onClick={() => {
                  retries.current = 0;
                  setStatus("loading");
                  setMessage("আবার চেষ্টা করছি…");
                  teardown();
                  attach();
                }}
                className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25"
              >
                আবার চেষ্টা করুন
              </button>
            </>
          )}
          <p className="pointer-events-none absolute bottom-3 left-0 right-0 truncate px-4 text-[11px] text-white/45">
            {cameraName}
          </p>
        </div>
      )}

      {status === "playing" && !compact && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 opacity-0 transition group-hover:opacity-100">
          <p className="truncate text-[11px] font-medium text-white/85">{cameraName}</p>
        </div>
      )}
    </div>
  );
}

export default CloudPlayer;
