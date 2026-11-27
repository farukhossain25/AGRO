import { z } from "zod";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  order: z.string().trim().min(4).max(32),
  phone: z.string().trim().min(6).max(20),
});

function normalisePhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.slice(-10); // last 10 digits, ignores +88 / 0 prefix differences
}

/**
 * Show a phone number without handing out the number.
 *
 * Tracking is reachable by anyone who knows an order number — `BA-260101-0001`
 * is a date plus a counter, so enumeration is realistic. The request already
 * proves ownership of the phone (it is compared below), so echoing it back in
 * full would turn the endpoint into a lookup service for other people's
 * numbers: guess an order number, send a plausible phone, read the real one.
 * Four digits is enough for the customer to recognise their own order.
 */
function maskPhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/* ==========================================================================
   GET /api/orders/track?order=BA-…&phone=…
   --------------------------------------------------------------------------
   Public order tracking. No session, so the order number PLUS the phone number
   is the credential — the same pair a courier call would ask for.

   WHAT THIS ROUTE MUST NOT RETURN
   --------------------------------------------------------------------------
   It used to select `*` and then spread the row into the response, which
   included the customer's email, the full phone, `user_id` (a profile UUID
   that unlocks anything keyed on the user), `payment_ref` (the TrxID —
   reusable as proof-of-payment in a dispute, and the sender's number),
   `wallet_used`, `delivered_by`, `admin_note`, and the full street address.

   Tracking needs: what was ordered, whether it arrived, when, and how much.
   Everything else is data this caller has no claim on. The columns are listed
   explicitly below rather than filtered afterwards, so a column added to
   `orders` later cannot leak by default.
   ========================================================================== */

/** The exact shape the select below returns. Written out because Supabase's
 *  types cannot infer a joined select at compile time — without it every field
 *  access degrades to an error type and the narrowing stops being checked. */
type TrackedOrder = {
  order_no: string;
  status: string;
  payment_method: string;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  division: string;
  district: string;
  upazila: string;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  eta_days: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string | null;
  order_items: { name_bn: string; quantity: number; price: number }[];
};

export async function GET(req: Request) {
  try {
    // Tracking is an enumeration target — keep the window tight.
    const limited = rateLimit(clientKey(req, "track"), 10, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const url = new URL(req.url);
    const { order, phone } = schema.parse({
      order: url.searchParams.get("order") ?? "",
      phone: url.searchParams.get("phone") ?? "",
    });

    const { data, error } = await db()
      .from("orders")
      .select(
        [
          "order_no",
          "status",
          "payment_method",
          "payment_status",
          "customer_name",
          // needed to verify the caller, and masked before it leaves
          "customer_phone",
          "division",
          "district",
          "upazila",
          "subtotal",
          "delivery_charge",
          "discount",
          "total",
          "eta_days",
          "cancel_reason",
          "created_at",
          "updated_at",
          "order_items(name_bn, quantity, price)",
        ].join(", ")
      )
      .eq("order_no", order.toUpperCase())
      .maybeSingle<TrackedOrder>();

    if (error) throw error;
    if (!data) return fail("এই অর্ডার নম্বরে কোনো অর্ডার পাওয়া যায়নি", 404);

    if (normalisePhone(data.customer_phone) !== normalisePhone(phone)) {
      return fail("অর্ডার নম্বর ও মোবাইল নম্বর মিলছে না", 403);
    }

    /* The row is rebuilt field by field instead of spread. Two reasons: a
       `...data` of a narrowed select still ships whatever the select grows
       into, and rebuilding makes the shape of this response a deliberate
       decision rather than a side effect. */
    return ok({
      order_no: data.order_no,
      status: data.status,
      payment_method: data.payment_method,
      payment_status: data.payment_status,
      customer_name: data.customer_name,
      phone: maskPhone(data.customer_phone),
      division: data.division,
      district: data.district,
      upazila: data.upazila,
      subtotal: data.subtotal,
      delivery_charge: data.delivery_charge,
      discount: data.discount,
      total: data.total,
      eta_days: data.eta_days,
      cancel_reason: data.cancel_reason,
      created_at: data.created_at,
      updated_at: data.updated_at,
      order_items: (data.order_items ?? []).map((item) => ({
        name_bn: item.name_bn,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
