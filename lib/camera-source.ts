/* ==========================================================================
   Which player a camera row needs
   --------------------------------------------------------------------------
   Dependency-free on purpose: the same answer is needed on the server
   (lib/supplier.ts) and inside "use client" components (FarmCameras), and a
   module that imports the Supabase client would drag it into the browser
   bundle.

   THE BUG THIS EXISTS FOR
   The product page mounted the RTSP player for every row. A camera configured
   through Imou/EZVIZ, or a channel added with an m3u8 link, was handed to
   `/api/stream/token`, which plays a MediaMTX `stream_key` and nothing else.
   It found no key and answered "এই ক্যামেরার স্ট্রিম কনফিগার করা হয়নি" — a card
   blaming the owner for a row that was configured perfectly, just not there.

   THE SECOND BUG — "I pasted the link and it still does not play"
   The admin form defaults `cloud_provider` to `none` (MediaMTX/RTSP). Paste an
   https .m3u8 and forget the dropdown — the most natural mistake, because the
   link is the thing you came to paste — and the row claimed RTSP while holding
   a perfect HLS URL. Nothing played it.

   So a filled https `stream_url` is treated as a statement about what the row
   is. The dropdown still wins when it names a provider; it only loses when it
   says "no cloud source" and the row is carrying one anyway.
   ========================================================================== */

export type CameraSource = "rtsp" | "cloud" | "tv";

/**
 * @param cloudProvider `cameras.cloud_provider` (null on a pre-migration-24 db)
 * @param streamUrl     `cameras.stream_url` — an https playlist, if any
 */
export function cameraSourceOf(
  cloudProvider: string | null | undefined,
  streamUrl?: string | null
): CameraSource {
  if (cloudProvider === "tv") return "tv";
  if (cloudProvider && cloudProvider !== "none") return "cloud";

  /* `none`, empty or missing. A pasted https playlist means this row is an HLS
     source whatever the dropdown says — the same conclusion
     resolveCloudHls() reaches for `hls`. */
  if (streamUrl && /^https:\/\//i.test(streamUrl.trim())) return "cloud";
  return "rtsp";
}

/**
 * Short words for a table cell — the same vocabulary as the form's select, so
 * a row never disagrees with its editor. (The form's labels are longer and
 * carry an explanation; those belong next to the control, not in a column.)
 */
export const PROVIDER_LABEL_BN: Record<string, string> = {
  none: "MediaMTX / RTSP",
  hls: "ক্লাউড HLS (ক্যামেরা)",
  tv: "লাইভ টিভি চ্যানেল",
  imou: "Imou Life",
  ezviz: "EZVIZ",
};

/** Who may watch this row, in words — the tick is not the whole story for tv. */
export function audienceLabelBn(
  cloudProvider: string | null | undefined,
  isPremium: boolean | null | undefined
): string {
  if (cloudProvider === "tv") return "সবার জন্য ফ্রি (টিভি)";
  return isPremium === false ? "সবার জন্য খোলা" : "প্রিমিয়াম";
}
