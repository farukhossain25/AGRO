import { db } from "./db";
import { notify } from "./notify";
import type { Database } from "./database.types";
import type { Order, OrderItem, PaymentMethod } from "./types";

/* ==========================================================================
   Checkout — one call, one transaction
   --------------------------------------------------------------------------
   Everything money-related happens inside `place_order()` in SQL, so a failed
   line can never leave a half-written order behind:

     • prices are re-read from the catalogue (client prices are ignored)
     • stock is reserved with a guarded UPDATE (`stock >= quantity`)
     • the coupon is validated and its `used_count` bumped
     • the delivery charge comes from `delivery_charges` / site settings
     • the order header, order_items, per-seller sub_orders, the payment row,
       the parcel (with its QR token) and the in-app notifications are written
       in the same transaction

   This module only translates the RPC's Bangla error codes into messages the
   cart can show, and reads the finished order back for the confirmation page.
   ========================================================================== */

export type IncomingItem = {
  id: string;
  kind: "product" | "combo";
  quantity: number;
  /** Sent by the cart since 2026-11 so a stale id can still be resolved. */
  slug?: string;
  /** Only used to name the product in an error message. */
  name?: string;
};

export type UnavailableLine = {
  id: string;
  slug?: string;
  name: string;
  reason: string;
};

type RpcResult = {
  order_id: string;
  order_no: string;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  wallet_used?: number;
  total: number;
  method_code: string;
  eta_days: string;
  item_count: number;
};

/** RPC code → customer-facing Bangla. Anything unknown falls back to a retry
 *  message; the real sentence is always logged server-side. */
function translate(code: string, detail: string): { message: string; status: number } {
  switch (code) {
    case "CART_EMPTY":
      return { message: "আপনার কার্টে কোনো পণ্য নেই — প্রথমে পণ্য যোগ করুন।", status: 422 };
    case "CUSTOMER_INCOMPLETE":
      return { message: "নাম, মোবাইল নম্বর ও সম্পূর্ণ ঠিকানা পূরণ করুন।", status: 422 };
    case "PAYMENT_METHOD_UNAVAILABLE":
      return { message: "এই পেমেন্ট মাধ্যমটি এখন বন্ধ আছে — অন্য একটি বেছে নিন।", status: 422 };
    case "COUPON_INVALID":
      return { message: "কুপন কোডটি সঠিক নয় বা মেয়াদ শেষ হয়েছে।", status: 422 };
    case "COUPON_USED_BY_USER":
      return { message: "এই কুপন আপনি ইতিমধ্যে ব্যবহার করেছেন — প্রতিটি অ্যাকাউন্টে একবারই চলে।", status: 409 };
    case "COUPON_NOT_FOR_USER":
      return { message: "এই কুপনটি আপনার অ্যাকাউন্টের জন্য প্রযোজ্য নয়।", status: 403 };
    case "COUPON_MIN_ORDER":
      return { message: `এই কুপনের জন্য কমপক্ষে ৳${detail} টাকার অর্ডার লাগবে।`, status: 422 };
    case "WALLET_INSUFFICIENT":
      return { message: "ওয়ালেট ব্যালেন্স যথেষ্ট নয় — অঙ্কটি কমিয়ে আবার চেষ্টা করুন।", status: 422 };
    case "COMBO_UNAVAILABLE":
      return {
        message: detail
          ? `"${detail}" কম্বোটি এখন পাওয়া যাচ্ছে না — কার্ট থেকে সরিয়ে আবার চেষ্টা করুন।`
          : "কার্টে থাকা একটি কম্বো এখন পাওয়া যাচ্ছে না — কার্ট থেকে সরিয়ে আবার চেষ্টা করুন।",
        status: 409,
      };
    case "PRODUCT_UNAVAILABLE":
      return { message: `"${detail}" এখন পাওয়া যাচ্ছে না — কার্ট থেকে সরিয়ে আবার চেষ্টা করুন।`, status: 409 };
    case "OUT_OF_STOCK":
      return { message: `"${detail}" এর স্টক শেষ — পরিমাণ কমিয়ে বা সরিয়ে আবার চেষ্টা করুন।`, status: 409 };
    /* The database itself refused because our SQL and its schema disagree —
       a missing column, a NOT NULL without a value, a missing GRANT. That is a
       deployment bug, not a customer mistake, so say so instead of the generic
       "try again" (which is what made the broken shop look like a fluke). */
    case "DB_NOT_NULL":
    case "DB_COLUMN":
    case "DB_PERMISSION":
    case "DB_FK":
    case "DB_CHECK":
    case "DB_ENUM":
      return {
        message:
          "অর্ডারটি সংরক্ষণ করা গেল না — সাইটে একটি কারিগরি সমস্যা আছে। একটু পরে আবার চেষ্টা করুন, অথবা হোয়াটসঅ্যাপে সরাসরি অর্ডার করুন।",
        status: 503,
      };
    default:
      return {
        message:
          "অর্ডারটি সম্পন্ন করা যায়নি — একটু পরে আবার চেষ্টা করুন। সমস্যা থেকে গেলে হোয়াটসঅ্যাপে জানান।",
        status: 500,
      };
  }
}

export async function createOrder(params: {
  userId: string | null;
  customer: {
    customer_name: string;
    phone: string;
    email?: string;
    division: string;
    district: string;
    upazila: string;
    address: string;
    delivery_note?: string;
  };
  paymentMethod: PaymentMethod;
  items: IncomingItem[];
  couponCode?: string;
  /** Taka to take from the wallet. Clamped server-side by place_order(). */
  walletAmount?: number;
}): Promise<{ order: Order & { order_items: OrderItem[] }; lines: OrderItem[] }> {
  const client = db();

  const items = params.items
    .filter((item) => item && item.id)
    .map((item) => ({
      id: item.id,
      kind: item.kind === "combo" ? "combo" : "product",
      quantity: Math.max(1, Math.min(99, Math.trunc(Number(item.quantity) || 1))),
      ...(item.slug ? { slug: item.slug } : {}),
    }));

  const { data, error } = await client.rpc("place_order", {
    p_user: params.userId,
    p_customer: {
      customer_name: params.customer.customer_name,
      phone: params.customer.phone,
      customer_phone: params.customer.phone,
      email: params.customer.email ?? "",
      division: params.customer.division,
      district: params.customer.district,
      upazila: params.customer.upazila,
      address: params.customer.address,
      delivery_note: params.customer.delivery_note ?? "",
    },
    p_items: items,
    p_payment_method: params.paymentMethod,
    p_coupon: params.couponCode ?? null,
    p_wallet: Math.max(0, Number(params.walletAmount ?? 0)),
  } as unknown as Database["public"]["Functions"]["place_order"]["Args"]);

  if (error) {
    const raw = error.message ?? "";

    /* Not a refusal at all — the connection to the database died. Say that,
       because "আবার চেষ্টা করুন" is the right advice and the owner needs to
       know it was infra, not a cart problem. */
    if (/fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket hang up|Failed to fetch/i.test(raw)) {
      console.error("[orders] place_order unreachable:", raw, error.details ?? "");
      const offline = new Error(
        "ডেটাবেসে সংযোগ করা যাচ্ছে না — একটু পরে আবার চেষ্টা করুন, অথবা হোয়াটসঅ্যাপে সরাসরি অর্ডার করুন।"
      ) as Error & { status?: number; code?: string };
      offline.status = 503;
      offline.code = "DB_UNREACHABLE";
      throw offline;
    }

    const [code, ...rest] = raw.split(":");
    const detail = rest.join(":").trim();
    const { message, status } = translate(code.trim(), detail);

    console.error("[orders] place_order failed:", raw, error.details ?? "", error.hint ?? "");

    const wrapped = new Error(message) as Error & {
      status?: number;
      unavailable?: UnavailableLine[];
      code?: string;
    };
    wrapped.status = status;
    wrapped.code = code.trim();

    if (status === 409) {
      const extras = params.items
        .filter((item) => item.name)
        .map((item) => ({
          id: item.id,
          slug: item.slug,
          name: item.name ?? item.id,
          reason: "স্টক শেষ বা বন্ধ",
        }));
      if (
        code.trim() === "PRODUCT_UNAVAILABLE" ||
        code.trim() === "OUT_OF_STOCK" ||
        code.trim() === "COMBO_UNAVAILABLE"
      ) {
        const named = extras.filter((item) => item.name === detail);
        wrapped.unavailable = named.length ? named : extras;
      } else {
        wrapped.unavailable = extras;
      }
    }

    throw wrapped;
  }

  const result = data as unknown as RpcResult;

  const { data: row, error: readError } = await client
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", result.order_id)
    .single();

  if (readError || !row) {
    console.error("[orders] order placed but read-back failed:", readError?.message, result.order_no);
    // The order exists; the customer only needs its number to reach tracking.
    const minimal = {
      id: result.order_id,
      order_no: result.order_no,
      user_id: params.userId,
      customer_name: params.customer.customer_name,
      phone: params.customer.phone,
      email: params.customer.email ?? null,
      division: params.customer.division,
      district: params.customer.district,
      upazila: params.customer.upazila,
      address: params.customer.address,
      delivery_note: params.customer.delivery_note ?? null,
      subtotal: result.subtotal,
      delivery_charge: result.delivery_charge,
      discount: result.discount,
      wallet_used: result.wallet_used ?? 0,
      total: result.total,
      coupon_code: params.couponCode ?? null,
      payment_method: (result.method_code as PaymentMethod) ?? params.paymentMethod,
      payment_status: "pending" as const,
      payment_ref: null,
      status: "received" as const,
      created_at: new Date().toISOString(),
      updated_at: null,
      order_items: [],
    } satisfies Order & { order_items: OrderItem[] };
    return { order: minimal, lines: [] };
  }

  const orderItems = (row.order_items ?? []) as unknown as OrderItem[];
  const order = {
    ...(row as unknown as Order),
    phone: row.customer_phone,
    email: row.customer_email,
    order_items: orderItems,
  };

  return { order, lines: orderItems };
}
/* ==========================================================================
   Cancelling / deleting an order — one call, one transaction
   --------------------------------------------------------------------------
   This used to be seven independent HTTP round-trips from here: void the
   sub_orders, re-read each product, write its new stock, decrement the
   coupon, delete the redemption, refund the wallet, notify. Two things were
   wrong with that, and only one of them was theoretical:

     • **The DELETE route never refunded the wallet at all.** An order worth
       ৳300 of wallet credit could be deleted and the customer's balance stayed
       ৳300 lighter, with the ledger row's `order_id` set to null so nothing
       could ever prove it had happened.

     • Stock was read-modify-write in JavaScript, so two cancellations running
       together could both read `stock = 5` and both write `stock = 7`.

   Both now run inside `order_cancel()` / `order_delete()` in
   supabase/sql/30_critical_fixes.sql: the order row is locked FOR UPDATE,
   the status is checked once, and every consequence — stock, coupon, wallet,
   sub_orders — is undone in the same transaction. The refund only happens if
   the ledger really holds a debit for that order, so this function can never
   invent money.

   What is left here is the part the database cannot do: telling the customer
   and the sellers. That is deliberately *after* the commit — a notification
   failure must not roll back a refund.
   ========================================================================== */

export type CancelOutcome =
  | { result: "cancelled"; walletRefunded: number; stockRestored: number; couponRestored: boolean }
  | { result: "already" }
  | { result: "delivered" };

type CancelRpcRow = {
  result?: string;
  wallet_refunded?: number | string;
  stock_restored?: number | string;
  coupon_restored?: boolean;
};

/** RPC refusals that mean "nothing was changed" — the caller answers 409. */
const CANCEL_REFUSALS: Record<string, string> = {
  ORDER_NOT_FOUND: "অর্ডার পাওয়া যায়নি",
  ORDER_DELIVERED: "ডেলিভারি হয়ে যাওয়া অর্ডার বাতিল করা যায় না",
  ORDER_PAYMENT_UNRESOLVED: "পেমেন্ট নিষ্পত্তি না করে অর্ডার মোছা যাবে না",
};

export class OrderActionError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 409) {
    super(message);
    this.name = "OrderActionError";
    this.code = code;
    this.status = status;
  }
}

function raiseFrom(code: string): never {
  const key = Object.keys(CANCEL_REFUSALS).find((k) => code.includes(k));
  if (key) throw new OrderActionError(key, CANCEL_REFUSALS[key]);
  throw new OrderActionError("ORDER_FAILED", "অর্ডারটি প্রক্রিয়া করা গেল না — আবার চেষ্টা করুন");
}

/**
 * Cancel an order. Safe to call twice, safe to call concurrently: the second
 * call returns "already" and changes nothing.
 */
export async function cancelOrder(orderId: string, reason: string, actorId: string | null): Promise<CancelOutcome> {
  const { data, error } = await db().rpc("order_cancel", {
    p_order: orderId,
    p_reason: reason?.trim() || null,
    p_actor: actorId,
  } as never);

  if (error) {
    console.error("[orders] order_cancel failed:", error.message);
    raiseFrom(error.message ?? "");
  }

  const row = (data ?? {}) as CancelRpcRow;
  if (row.result === "already") return { result: "already" };
  if (row.result === "delivered") return { result: "delivered" };
  if (row.result !== "cancelled") raiseFrom("ORDER_FAILED");

  return {
    result: "cancelled",
    walletRefunded: Number(row.wallet_refunded ?? 0),
    stockRestored: Number(row.stock_restored ?? 0),
    couponRestored: Boolean(row.coupon_restored),
  };
}

/**
 * Delete an order, refunding whatever it still holds. The function refuses a
 * delivered order (that is a sale) and any order whose payment is still marked
 * paid — those have to be resolved, not erased.
 */
export async function deleteOrder(
  orderId: string,
  actorId: string | null
): Promise<{ orderNo: string; walletRefunded: number; stockRestored: number; couponRestored: boolean }> {
  const { data, error } = await db().rpc("order_delete", {
    p_order: orderId,
    p_actor: actorId,
  } as never);

  if (error) {
    console.error("[orders] order_delete failed:", error.message);
    raiseFrom(error.message ?? "");
  }

  const row = (data ?? {}) as CancelRpcRow & { order_no?: string };
  return {
    orderNo: String(row.order_no ?? ""),
    walletRefunded: Number(row.wallet_refunded ?? 0),
    stockRestored: Number(row.stock_restored ?? 0),
    couponRestored: Boolean(row.coupon_restored),
  };
}

/**
 * Tell the people the database cannot reach. Runs after the commit; a failure
 * here is logged and swallowed because the money has already moved correctly.
 */
export async function announceCancellation(
  order: { id: string; order_no: string; user_id: string | null },
  reason: string
): Promise<void> {
  const client = db();
  const note = reason.trim() || "অ্যাডমিনের সিদ্ধান্তে";

  if (order.user_id) {
    await notify({
      userId: order.user_id,
      audience: "user",
      kind: "order",
      title: `অর্ডার ${order.order_no} বাতিল করা হয়েছে`,
      body: note,
      link: "/account/orders",
    }).catch((error) => console.error("[cancel:notify:customer]", error));
  }

  try {
    // Two plain reads instead of an embedded join: the seller's login id lives
    // on `sellers.user_id`, not on the sub_order.
    const { data: shares } = await client.from("sub_orders").select("seller_id").eq("order_id", order.id);
    const sellerIds = [...new Set((shares ?? []).map((s) => s.seller_id).filter((v): v is string => !!v))];
    if (!sellerIds.length) return;

    const { data: sellerRows } = await client.from("sellers").select("id, user_id").in("id", sellerIds);
    for (const seller of sellerRows ?? []) {
      if (!seller.user_id) continue;
      await notify({
        userId: seller.user_id,
        audience: "seller",
        kind: "order",
        title: `অর্ডার বাতিল — ${order.order_no}`,
        body: "এই বিক্রয়টি আপনার হিসাব থেকে বাদ দেওয়া হয়েছে।",
        link: "/seller",
      }).catch(() => undefined);
    }
  } catch (error) {
    console.error("[cancel:notify:sellers]", error);
  }
}
