import { listComplaints } from "@/lib/reviews";
import {
  ComplaintConsole,
  type AdminComplaintRow,
} from "@/components/admin/complaint-console";
import { db, isDbConfigured } from "@/lib/db";
import { signComplaintPhotos } from "@/lib/storage-sign";

export const dynamic = "force-dynamic";

export const metadata = { title: "অভিযোগ ব্যবস্থাপনা" };

/* ==========================================================================
   the panel’s complaint console — every ticket, filterable by status and seller
   ========================================================================== */

export default async function AdminComplaintsPage() {
  const raw = await listComplaints({ status: "all" });

  // resolve the order number for each ticket (best effort, one query)
  const orderIds = Array.from(new Set(raw.map((r) => r.order_id).filter(Boolean)));
  const orderNos = new Map<string, string>();

  if (isDbConfigured() && orderIds.length) {
    try {
      const { data } = await db()
        .from("orders")
        .select("id, order_no")
        .in("id", orderIds.slice(0, 200));
      for (const row of data ?? []) orderNos.set(row.id as string, row.order_no as string);
    } catch {
      /* order numbers are cosmetic */
    }
  }

  const rows: AdminComplaintRow[] = raw.map((row) => ({
    id: row.id,
    ticket_no: row.ticket_no,
    problem_type: row.problem_type,
    description: row.description,
    photos: row.photos ?? null,
    preferred_resolution: row.preferred_resolution,
    status: row.status,
    created_at: row.created_at,
    seller_id: row.seller_id,
    products: row.products,
    sellers: row.sellers,
    order_no: orderNos.get(row.order_id) ?? null,
  }));

  /* complaint-photos is a private bucket (migration 29 §7). The stored value
     is a path; the console needs a URL. Signing here — after the panel has
     already authorised the staff member — means the 5-minute link never
     exists anywhere except in this render. An object that cannot be signed
     is dropped rather than shown as a broken image. */
  await Promise.all(
    rows.map(async (row) => {
      if (row.photos?.length) {
        row.photos = (await signComplaintPhotos(row.photos)).filter(
          (url: string | null): url is string => Boolean(url)
        );
      }
    })
  );

  return <ComplaintConsole initial={rows} />;
}
