import { z } from "zod";
import { handleError, ok, requirePermission } from "@/lib/api";
import { checkUpstreamUrl } from "@/lib/upstream-guard";
import { classifyPlaylistText } from "@/lib/camera-cloud";

export const dynamic = "force-dynamic";

/* ==========================================================================
   POST /api/foisal/channel-check — "why is this channel not playing?"
   --------------------------------------------------------------------------
   Pasting a link and waiting for a spinner tells the owner nothing. This route
   walks the SAME chain the player walks, server-side, and reports each hop:

     hop 1  the pasted URL        → what is it? a list / a master / a media
     hop 2  the URL it named      → …
     hop 3  …

   The answer says, in Bangla, whether the chain ends at a real stream and what
   the final URL is; or exactly which hop failed and why (bad scheme, private
   host, 403 from the host, not a playlist at all, too many hops).

   It is deliberately admin-only (`requirePermission`): it makes the server
   fetch a URL the caller chooses, which is the SSRF shape. The guard in
   lib/upstream-guard.ts still runs on every hop, but a panel user is the only
   person who may ask at all.
   ========================================================================== */

const schema = z.object({
  url: z.string().trim().url("লিংকটি সঠিক নয়"),
});

type HopReport = {
  hop: number;
  url: string;
  status?: number;
  contentType?: string;
  kind?: "master" | "media" | "list" | "unknown";
  bytes?: number;
  next?: string;
  error?: string;
};

const MAX_HOPS = 3;
const HOP_TIMEOUT_MS = 6000;

export async function POST(req: Request) {
  try {
    await requirePermission("settings.write");

    const { url } = schema.parse(await req.json());

    const hops: HopReport[] = [];
    let current = url;
    let finalUrl: string | null = null;

    for (let hop = 1; hop <= MAX_HOPS; hop++) {
      const report: HopReport = { hop, url: current };

      /* The same gate the player path uses, reported rather than thrown so the
         owner sees WHICH hop was refused. */
      const gate = checkUpstreamUrl(current);
      if (!gate.ok) {
        report.error = gate.reason;
        hops.push(report);
        break;
      }

      let res: Response;
      try {
        res = await fetch(gate.url, {
          headers: { "user-agent": "BiswasAgro-Playlist/1.0" },
          cache: "no-store",
          redirect: "follow",
          signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
        });
      } catch (error) {
        report.error = `সংযোগ ব্যর্থ (${(error as Error).name})`;
        hops.push(report);
        break;
      }

      report.status = res.status;
      report.contentType = res.headers.get("content-type") ?? "(none)";

      if (!res.ok) {
        report.error = `হোস্ট ${res.status} ফেরত দিয়েছে`;
        hops.push(report);
        break;
      }

      const text = (await res.text()).slice(0, 512 * 1024);
      report.bytes = text.length;

      const verdict = classifyPlaylistText(text, current.replace(/[^/]*$/, ""));
      report.kind = verdict.kind;

      if (verdict.kind === "master" || verdict.kind === "media") {
        finalUrl = current;
        hops.push(report);
        break;
      }

      /* 200 with a login page or an "offline" notice instead of a playlist.
         Reporting this as a stream is how the owner ends up staring at a
         spinner while the panel insists everything is fine. */
      if (verdict.kind === "unknown") {
        report.error = "প্লেলিস্ট নয় — হোস্ট HTML/ভিন্ন কিছু পাঠিয়েছে (চ্যানেলটি সম্ভবত বন্ধ)";
        hops.push(report);
        break;
      }

      if (!verdict.next) {
        report.error = "তালিকায় কোনো চ্যানেলের লিংক নেই";
        hops.push(report);
        break;
      }

      report.next = verdict.next;
      hops.push(report);
      current = verdict.next;
    }

    /* `ok()` wraps its argument in { ok: true, data } — so the chain's own
       verdict must live inside `data`, not be spread beside it. Sending
       `ok(...)` with a nested `ok` field gave every failed chain a top-level
       `ok: true` and the card rendered a green tick over a dead link. */
    const reached = Boolean(finalUrl);
    return ok({
      reached,
      finalUrl,
      hops,
      message: reached
        ? "চেইন ঠিক আছে — এই লিংকটি প্লেয়ার চালাতে পারবে"
        : "চেইনটি কোনো স্ট্রিমে পৌঁছায়নি — নিচের ধাপ দেখুন",
    });
  } catch (error) {
    return handleError(error);
  }
}
