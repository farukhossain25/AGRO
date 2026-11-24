"use client";

import dynamic from "next/dynamic";
import { Play, Video } from "lucide-react";
import { useState } from "react";

/* ==========================================================================
   LiveStreamLazy — section C code-splitting for the HLS player
   --------------------------------------------------------------------------
   hls.js is ~150 kB minified. Almost nobody watches a stream on the first
   paint of a farm page, and Lighthouse counts it in "unused JavaScript".
   So the player chunk is only fetched after one of these happens:

     • the visitor taps the poster / play button
     • the placeholder scrolls into the viewport AND the pointer has been idle
       for a moment (a "user is actually looking at this" heuristic)

   The poster is a real <img> with width/height, so CLS stays at 0 and the LCP
   element is still a normal optimised image.
   ========================================================================== */

const LiveStream = dynamic(() => import("./live-stream").then((m) => m.LiveStream), {
  ssr: false,
  loading: () => (
    <div
      className="grid aspect-video w-full place-items-center rounded-2xl bg-black ring-1 ring-white/10"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="flex items-center gap-2 text-[12.5px] text-white/50">
        <Video className="h-4 w-4 animate-pulse" /> লাইভ প্লেয়ার লোড হচ্ছে…
      </span>
    </div>
  ),
});

export type LazyStreamProps = {
  cameraId: string;
  cameraName: string;
  poster?: string | null;
  autoPlay?: boolean;
  muted?: boolean;
  compact?: boolean;
  className?: string;
  onMode?: (mode: "premium" | "trial" | "locked") => void;
  /** Set for the primary camera on a farm page — skips the tap-to-start gate. */
  eager?: boolean;
};

export function LiveStreamLazy({ poster, cameraName, eager = false, ...rest }: LazyStreamProps & { eager?: boolean }) {
  const [armed, setArmed] = useState(eager);

  if (armed) {
    return <LiveStream poster={poster} cameraName={cameraName} {...rest} />;
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      aria-label={`লাইভ দেখুন — ${cameraName}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt={cameraName}
          width={1280}
          height={720}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
        />
      ) : (
        <span className="grid h-full w-full place-items-center bg-ink-850">
          <Video className="h-8 w-8 text-white/25" />
        </span>
      )}

      <span className="absolute inset-0 grid place-items-center">
        <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2.5 text-[12.5px] font-semibold text-white ring-1 ring-white/20 backdrop-blur transition group-hover:bg-leaf-600/80">
          <Play className="h-4 w-4 fill-white" aria-hidden />
          লাইভ দেখুন
        </span>
      </span>

      <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-[10px] font-semibold tracking-wide text-white">লাইভ</span>
      </span>
    </button>
  );
}
