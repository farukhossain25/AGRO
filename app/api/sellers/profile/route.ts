import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import type { TablesUpdate } from "@/lib/database.types";
import { clientIp, fail, handleError, limitGuard, ok, requireUser } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getSellerByUser } from "@/lib/sellers";

export const dynamic = "force-dynamic";

/* ==========================================================================
   PATCH /api/sellers/profile — the seller's own store branding
   --------------------------------------------------------------------------
   Body: { logo?: string | null, banner?: string | null }
     • logo   — square mark shown on the store page, the marketplace cards and
               the seller dashboard header
     • banner — wide cover of the store page (replaces the old "first farm
               photo" fallback once set)
   The files themselves are uploaded first through /api/upload (buckets
   `logos` / `farm-images`, approved sellers only); this route only stores the
   public URL on the seller's own row. A seller can never touch another row.
   ========================================================================== */

const schema = z.object({
  logo: z.string().trim().max(600).nullable().optional(),
  banner: z.string().trim().max(600).nullable().optional(),
});

/** A stored asset is either our public storage URL or a local /images path. */
function isAssetUrl(value: string): boolean {
  return /^https:\/\/[^\s]+$/i.test(value) || /^\/[\w\-./%]+$/.test(value);
}

export async function PATCH(req: Request) {
  try {
    const guard = limitGuard(req, "seller-brand", 20, 60_000);
    if (guard) return guard;

    const user = await requireUser();
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const seller = await getSellerByUser(user.id);
    if (!seller) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);

    const body = schema.parse(await req.json());
    const patch: TablesUpdate<"sellers"> = {};
    for (const key of ["logo", "banner"] as const) {
      if (body[key] === undefined) continue;
      const value = body[key];
      if (value && !isAssetUrl(value)) return fail("ছবির লিংক সঠিক নয় — আবার আপলোড করুন", 422);
      patch[key] = value || null;
    }
    if (!Object.keys(patch).length) return fail("কিছু পরিবর্তন করা হয়নি", 422);

    const before = { logo: seller.logo ?? null, banner: seller.banner ?? null };

    const { data, error } = await db()
      .from("sellers")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", seller.id)
      .select("id, logo, banner, slug")
      .single();
    if (error) throw error;

    // The store page and the marketplace grid are dynamic, but any cached
    // path underneath them must not keep showing the previous picture.
    revalidatePath(`/market/${seller.slug}`);
    revalidatePath("/market");

    await recordAudit({
      actor: user,
      action: "update",
      entity: "sellers",
      entityId: seller.id,
      diff: { logo: { from: before.logo, to: data.logo ?? null }, banner: { from: before.banner, to: data.banner ?? null } },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok({ id: data.id, logo: data.logo ?? null, banner: data.banner ?? null });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if (code === 403) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);
    return handleError(error);
  }
}
