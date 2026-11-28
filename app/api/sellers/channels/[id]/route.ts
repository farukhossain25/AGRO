import { db } from "@/lib/db";
import { fail, handleError, ok, requireUser } from "@/lib/api";
import { getSellerByUser } from "@/lib/sellers";
import { ensureSellerFarm } from "@/lib/seller-farm";

export const dynamic = "force-dynamic";

/* ==========================================================================
   DELETE /api/sellers/channels/<id> — a seller removes one of their channels
   --------------------------------------------------------------------------
   Ownership is decided by the FARM, not by the id in the URL: the row must
   belong to the farm this seller already owns. Checking the id alone would let
   any signed-in seller delete any channel on the site by guessing a uuid — the
   same class of mistake the RLS policies exist to prevent, and one the admin
   API avoids by looking at the table it is allowed to write.

   Only `cloud_provider = 'tv'` rows can be removed here. A camera someone
   installed is not a seller's to delete from this screen; that is what the
   camera-request workflow is for.
   ========================================================================== */

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("চ্যানেল আইডি সঠিক নয়", 422);

    const user = await requireUser();
    const seller = await getSellerByUser(user.id);
    if (!seller) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);

    const farm = seller.farm_id
      ? { id: seller.farm_id }
      : await ensureSellerFarm(seller).catch(() => null);
    if (!farm) return fail("খামার পাওয়া যায়নি", 404);

    const { data: row } = await db()
      .from("cameras")
      .select("id, farm_id, cloud_provider")
      .eq("id", id)
      .maybeSingle();

    /* Same answer for "does not exist" and "not yours": telling a caller which
       one it was turns this into a way to discover other sellers' channel
       ids. */
    if (!row || row.farm_id !== farm.id) return fail("চ্যানেল পাওয়া যায়নি", 404);
    if (row.cloud_provider !== "tv") {
      return fail("ক্যামেরা এখান থেকে মোছা যায় না — সাপোর্টে যোগাযোগ করুন", 403);
    }

    const { error } = await db().from("cameras").delete().eq("id", id);
    if (error) throw error;

    return ok({ id });
  } catch (error) {
    return handleError(error);
  }
}
