import { z } from "zod";
import { db } from "@/lib/db";
import { created, fail, handleError, limitGuard, requireUser } from "@/lib/api";
import { getSellerByUser } from "@/lib/sellers";
import { ensureSellerFarm } from "@/lib/seller-farm";

export const dynamic = "force-dynamic";

/* ==========================================================================
   POST /api/sellers/channels — a seller adds their own live TV channel
   --------------------------------------------------------------------------
   The same .m3u8 path the admin panel uses for /live, offered to the seller who
   actually runs the farm. They paste a channel URL, it appears on their farm's
   live page, and it plays through the same signed-token proxy — no public IP,
   no VPS, no port forwarding. That is the whole reason this route exists while
   there is no public IP: a camera needs one, a channel does not.

   Three things it deliberately does NOT do:

     • trust the URL. It is validated here (https, .m3u8 or .m3u) and resolved
       again server-side at playback time. A typo fails at save with a Bangla
       message instead of a dead player on the storefront.
     • let a seller hang a channel on someone else's farm. The farm id comes
       from `ensureSellerFarm(seller)`, never from the request body.
     • make it premium. A `tv` row is always public (see lib/watch-rights.ts);
       there is nothing to sell and no vendor quota to protect.

   It does NOT create a camera. The row lands in `cameras` only because that is
   where every player already looks — the app treats `cloud_provider = 'tv'` as
   a channel everywhere it counts, labels or gates.
   ========================================================================== */

const schema = z.object({
  name_bn: z.string().trim().min(2, "চ্যানেলের নাম দিন").max(80),
  stream_url: z
    .string()
    .trim()
    .url("লিংকটি সঠিক নয়")
    .refine((v) => /^https:\/\//i.test(v), "লিংকটি https:// দিয়ে 시작 হতে হবে")
    /* .m3u8 or .m3u — and, because channel-list services hand out URLs whose
       path says nothing (…/my_list/s/4e79…abc4.m3u8 is fine, but plenty end in
       a bare token), a URL that merely *looks* like a playlist path is
       accepted too. The server decides what it really is at playback time by
       reading the body, not by trusting this string. */
    .refine((v) => /\.(m3u8?|mpd)(\?|#|$)/i.test(v) || /playlist|m3u/i.test(v), "লিংকটি .m3u8 বা .m3u হতে হবে"),
  zone_bn: z.string().trim().max(30).optional().or(z.literal("")),
});

/** How many channels one seller may add — a guard against a loud typo loop. */
const MAX_CHANNELS_PER_SELLER = 12;

export async function POST(req: Request) {
  try {
    const guard = limitGuard(req, "seller-channel", 10, 60 * 60_000);
    if (guard) return guard;

    const user = await requireUser();
    const seller = await getSellerByUser(user.id);
    if (!seller) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);
    if (seller.status !== "approved") {
      return fail("আপনার সেলার অ্যাকাউন্ট এখনো অনুমোদিত হয়নি", 403);
    }

    const data = schema.parse(await req.json());

    const farm = await ensureSellerFarm(seller);
    if (!farm) return fail("খামার তৈরি করা যাচ্ছে না — একটু পরে আবার চেষ্টা করুন", 503);

    /* ⚠️ Every write below runs on the SERVICE-ROLE client (lib/db.ts), which
       bypasses RLS. The policies in 35_seller_tv_channels.sql are therefore
       defence-in-depth, not the gate — THIS is the gate. That is why the farm
       id comes from `ensureSellerFarm(seller)` and never from the body, and why
       the insert below pins `cloud_provider: "tv"` and an https URL in code.
       If this file ever grows another writer, it needs the same three rules. */

    /* `cameras` is the table every player reads, so that is where a channel
       lives. Counting first keeps a seller from filling the page, and the cap
       is per farm rather than global. */
    const { data: existing, error: countError } = await db()
      .from("cameras")
      .select("id")
      .eq("farm_id", farm.id)
      .eq("cloud_provider", "tv");

    if (countError) throw countError;
    if ((existing ?? []).length >= MAX_CHANNELS_PER_SELLER) {
      return fail(`সর্বোচ্চ ${MAX_CHANNELS_PER_SELLER}টি চ্যানেল যোগ করা যায় — একটি মুছে আবার চেষ্টা করুন`, 422);
    }

    /* No duplicate URLs on one farm: the same link twice is the same picture
       twice, and it also means one channel counted as two in the stats. */
    const { data: duplicate } = await db()
      .from("cameras")
      .select("id")
      .eq("farm_id", farm.id)
      .eq("stream_url", data.stream_url)
      .maybeSingle();

    if (duplicate) return fail("এই চ্যানেলটি ইতিমধ্যেই যোগ করা আছে", 409);

    const { data: row, error } = await db()
      .from("cameras")
      .insert({
        farm_id: farm.id,
        name_bn: data.name_bn,
        zone_bn: data.zone_bn || "টিভি চ্যানেল",
        cloud_provider: "tv",
        stream_url: data.stream_url,
        /* A channel is always public: `is_premium` follows the platform rule,
           and `status` starts online because it was just verified to be a
           playlist URL — the player downgrades to "offline" on its own if the
           stream is dead when a viewer actually opens it. */
        is_premium: false,
        status: "online",
        is_active: true,
        max_viewers: 500,
        sort_order: 90,
      })
      .select("id, name_bn, stream_url, zone_bn, status, sort_order")
      .single();

    if (error) throw error;

    /* The farm detail page and the directory are cached per request; a new
       channel should be visible on the next load, which it is — but the live
       hub is force-dynamic, so nothing else needs busting here. */
    return created(row);
  } catch (error) {
    return handleError(error);
  }
}
