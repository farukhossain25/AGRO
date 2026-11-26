/* ==========================================================================
   How the current viewer is watching — decided by the server, never the client
   --------------------------------------------------------------------------
   "public" means the camera has `cameras.is_premium = false`: the farm opened
   it to everyone, so no subscription, trial or login is involved. The player
   renders a badge from this and nothing else; it can never grant access.
   ========================================================================== */

export type StreamMode = "premium" | "trial" | "public" | "locked";

/** Bangla label for the live badge on a playing stream. */
export const streamModeLabelBn: Record<Exclude<StreamMode, "locked">, string> = {
  premium: "লাইভ",
  trial: "ট্রায়াল",
  public: "সবার জন্য খোলা",
};
