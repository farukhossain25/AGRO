import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { getDairyFarms } from "@/lib/farms";

export const dynamic = "force-dynamic";

/**
 * GET /api/farms/dairy
 * --------------------------------------------------------------------------
 * Live-ish production board for /live/dairy.
 *
 * `daily_output` on the farm row holds the numbers a manager updates during
 * the day; we layer today's paid milk orders on top so the "sold" figure is
 * real, not typed in. All arithmetic is done here so the client just renders.
 */
export async function GET() {
  try {
    const farms = await getDairyFarms();

    // Milk line items sold today (any non-cancelled order).
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    let soldToday: { farm_id: string; litres: number }[] = [];

    try {
      const { data } = await db()
        .from("order_items")
        .select("qty, weight_grams, product_id, order_id, orders!inner(status, created_at), products!inner(farm_id, unit)")
        .gte("orders.created_at", start.toISOString())
        .neq("orders.status", "cancelled");

      const rows = (data ?? []) as unknown as Array<{
        qty: number;
        weight_grams: number | null;
        products: { farm_id: string | null; unit: string } | null;
      }>;

      const byFarm = new Map<string, number>();
      for (const row of rows) {
        if (!row.products?.farm_id) continue;
        if (!/লিটার|litre|liter|লি/i.test(row.products.unit ?? "")) continue;
        byFarm.set(row.products.farm_id, (byFarm.get(row.products.farm_id) ?? 0) + Number(row.qty));
      }
      soldToday = Array.from(byFarm, ([farm_id, litres]) => ({ farm_id, litres }));
    } catch {
      // A joined query can fail on an empty/older schema — the board still works
      // from the recorded daily_output numbers.
    }

    const sold = new Map(soldToday.map((s) => [s.farm_id, s.litres]));

    const board = farms.map((farm) => {
      const out = (farm.daily_output ?? {}) as Record<string, number | string>;
      const litresToday = Number(out.litres_today ?? 0);
      const soldLitres = sold.get(farm.id) ?? Number(out.sold_today ?? 0);

      return {
        id: farm.id,
        slug: farm.slug,
        name_bn: farm.name_bn,
        district: farm.district,
        cover: farm.cover,
        owner_name_bn: farm.owner_name_bn,
        cows: Number(out.cows ?? 0),
        litres_today: litresToday,
        sold_today: Math.round(soldLitres * 10) / 10,
        remaining_today: Math.max(0, Math.round((litresToday - soldLitres) * 10) / 10),
        percent_sold: litresToday > 0 ? Math.min(100, Math.round((soldLitres / litresToday) * 100)) : 0,
        note_bn: String(out.note_bn ?? ""),
        online_cameras: farm.online_cameras ?? 0,
        camera_count: farm.camera_count ?? 0,
        updated_at: String(out.updated_at ?? new Date().toISOString()),
        certifications: farm.certifications ?? [],
      };
    });

    const totals = board.reduce(
      (acc, f) => ({
        cows: acc.cows + f.cows,
        litres_today: acc.litres_today + f.litres_today,
        sold_today: acc.sold_today + f.sold_today,
        remaining_today: acc.remaining_today + f.remaining_today,
      }),
      { cows: 0, litres_today: 0, sold_today: 0, remaining_today: 0 }
    );

    return ok({ farms: board, totals, generatedAt: new Date().toISOString() });
  } catch (error) {
    return handleError(error);
  }
}
