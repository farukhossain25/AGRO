"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import type { StreamMode } from "@/lib/stream-mode";

/* ==========================================================================
   LiveStream — token-gated HLS player
   --------------------------------------------------------------------------
   Flow:
     1. POST /api/stream/token  → { url, expiresIn, mode }
     2. attach hls.js (or native HLS on Safari / iOS)
     3. re-mint the token at ~80% of its life and hot-swap the source
        without dropping the picture (hls.js loadSource keeps the buffer)

   Because the token is in the URL, hls.js segment requests carry it too, and
   the proxy rewrites playlist lines so nested playlists keep the token.
   ========================================================================== */

type Props = {
  cameraId: string;
  cameraName: string;
  /** Shown before playback starts / when the stream is locked. */
  poster?: string | null;
  autoPlay?: boolean;
  muted?: boolean;
  compact?: boolean;
  className?: string;
  onMode?: (mode: StreamMode) => void;
  /** Rendered instead of the video when the API says 402/403. */
  fallback?: React.ReactNode;
};

type TokenResponse = { url: string; expiresIn: number; mode: "premium" | "trial" | "public" };

/* No device "hint" is sent any more. It used to be mixed into the server-side
   trial identity, which made `hint` a client-controlled reset button. The token
   route now derives the fingerprint from IP + UA + language only. */

export function LiveStream({
  cameraId,
  cameraName,
  poster,
  autoPlay = true,
  muted = true,
  compact = false,
  className = "",
  onMode,
  fallback,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyedRef = useRef(false);

  const [status, setStatus] = useState<"loading" | "playing" | "locked" | "offline" | "error">("loading");
  const statusRef = useRef(status);
  statusRef.current = status;
  const [message, setMessage] = useState<string>("লাইভ স্ট্রিম লোড হচ্ছে…");

  const teardown = useCallback(() => {
    if (refreshRef.current) clearTimeout(refreshRef.current);
    refreshRef.current = null;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const attach = useCallback(
    async (isRefresh = false) => {
      if (destroyedRef.current) return;

      try {
        const res = await fetch("/api/stream/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cameraId }),
        });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          const locked = res.status === 402 || res.status === 403;
          setStatus(locked ? "locked" : res.status === 409 || res.status === 404 ? "offline" : "error");
          setMessage(json?.message ?? "স্ট্রিম চালু করা যাচ্ছে না");
          onMode?.("locked");
          return;
        }

        const { data } = json as { data: TokenResponse };

        if (refreshRef.current) clearTimeout(refreshRef.current);
        refreshRef.current = setTimeout(
          () => attach(true),
          Math.max(60_000, data.expiresIn * 0.8 * 1000)
        );

        onMode?.(data.mode);

        const video = videoRef.current;
        if (!video) return;

        const HlsLib = (await import("hls.js")).default;

        if (HlsLib.isSupported()) {
          if (!hlsRef.current) {
            const hls = new HlsLib({
              lowLatencyMode: true,
              backBufferLength: 10,
              liveSyncDurationCount: 3,
              manifestLoadingRetryDelay: 1500,
              manifestLoadingMaxRetry: 4,
              levelLoadingMaxRetry: 4,
              fragLoadingMaxRetry: 6,
            });
            hlsRef.current = hls;
            hls.attachMedia(video);
            hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
              setStatus("playing");
              setMessage("");
              if (autoPlay) video.play().catch(() => {});
            });
            hls.on(HlsLib.Events.ERROR, (_e, data) => {
              if (!data.fatal) return;
              if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR) {
                setStatus("offline");
                setMessage("ক্যামেরার সাথে সংযোগ বিচ্ছিন্ন — আবার চেষ্টা করছি…");
                // hls.js retries network errors internally; re-mint the token too.
                setTimeout(() => attach(true), 4000);
              } else {
                setStatus("error");
                setMessage("স্ট্রিম চালু করা যাচ্ছে না");
                hls.destroy();
                hlsRef.current = null;
              }
            });
          }
          hlsRef.current.loadSource(data.url);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Safari / iOS — native HLS
          video.src = data.url;
          video.addEventListener("loadedmetadata", () => {
            setStatus("playing");
            setMessage("");
            if (autoPlay) video.play().catch(() => {});
          });
        } else {
          setStatus("error");
          setMessage("আপনার ব্রাউজারে লাইভ স্ট্রিম চালানো যাচ্ছে না");
        }

        if (!isRefresh) {
          setStatus((s) => (s === "playing" ? s : "loading"));
        }
      } catch {
        setStatus("error");
        setMessage("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
      }
    },
    [cameraId, autoPlay, onMode]
  );

  useEffect(() => {
    destroyedRef.current = false;
    attach();
    return () => {
      destroyedRef.current = true;
      teardown();
    };
  }, [attach, teardown]);

  /**
   * Section B: a player scrolling out of view must stop playing (and buffering)
   * — it burns mobile data and battery otherwise. We pause rather than tear the
   * stream down so scrolling back is instant. Pausing is also polite for
   * prefers-reduced-motion users.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (autoPlay && video.paused && statusRef.current === "playing") {
              video.play().catch(() => {});
            }
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
    <div
      className={`group relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 ${className}`}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        muted={muted}
        playsInline
        controls={status === "playing"}
        className="aspect-video h-full w-full object-cover"
      />

      {/* live badge */}
      {status === "playing" && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-white">লাইভ</span>
        </div>
      )}

      {/* overlay states */}
      {status !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-black/70 via-black/80 to-black/90 px-6 text-center">
          {status === "locked" ? (
            <>{fallback ?? <LockedNotice message={message} />}</>
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

function LockedNotice({ message }: { message: string }) {
  return (
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
  );
}

export default LiveStream;
