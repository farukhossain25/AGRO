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
      return { message: "কার্টে থাকা একটি কম্বো এখন পাওয়া যাচ্ছে না — কার্ট থেকে সরিয়ে আবার চেষ্টা করুন।", status: 409 };
    case "PRODUCT_UNAVAILABLE":
      return { message: `"${detail}" এখন পাওয়া যাচ্ছে না — কার্ট থেকে সরিয়ে আবার চেষ্টা করুন।`, status: 409 };
    case "OUT_OF_STOCK":
      return { message: `"${detail}" এর স্টক শেষ — পরিমাণ কমিয়ে বা সরিয়ে আবার চেষ্টা করুন।`, status: 409 };
    default:
      return { message: "অর্ডারটি সম্পন্ন করা যায়নি — একটু পরে আবার চেষ্টা করুন।", status: 500 };
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
      if (code.trim() === "PRODUCT_UNAVAILABLE" || code.trim() === "OUT_OF_STOCK") {
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
   Cancelling an order — undo what place_order() did
   --------------------------------------------------------------------------
   Checkout reserves stock, counts the coupon and writes one sub_order per
   seller (that row IS the seller's money). Cancelling by flipping only
   `orders.status` left all of that standing: the seller kept the sale and the
   dashboard kept counting it, the stock never came back.

   The caller flips `orders.status` FIRST, guarded so only one request can
   ever win the transition into `cancelled`; this function then runs exactly
   once. Every step is still written to tolerate a repeat.
   ========================================================================== */

export type CancelTarget = {
  id: string;
  order_no: string;
  coupon_code: string | null;
  user_id: string | null;
  /** Wallet credit spent on this order — refunded on cancel. */
  wallet_used?: number | string | null;
};

/** Steps never throw: a failing side effect must not stop the ones after it. */
// PostgrestFilterBuilder is thenable but not a full Promise, hence PromiseLike.
async function step(name: string, run: () => PromiseLike<unknown>) {
  try {
    await run();
  } catch (error) {
    console.error(`[cancel:${name}]`, error);
  }
}

export async function applyOrderCancellation(order: CancelTarget, reason: string): Promise<void> {
  const client = db();

  // 1. the sellers' money: every open sub_order is voided, not deleted
  await step("sub_orders", () =>
    client
      .from("sub_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("order_id", order.id)
      .in("status", ["received", "packing", "shipped", "delivered"])
  );

  // 2. stock that was reserved at checkout goes back on the shelf
  //    (combo lines carry no product_id — their stock is not tracked per item)
  await step("stock", async () => {
    const { data: items } = await client
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", order.id)
      .not("product_id", "is", null);
    for (const item of items ?? []) {
      if (!item.product_id) continue;
      const { data: product } = await client
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .maybeSingle();
      if (!product) continue;
      await client
        .from("products")
        .update({ stock: Number(product.stock ?? 0) + Number(item.quantity ?? 0) })
        .eq("id", item.product_id);
    }
  });

  // 3. the coupon's used_count was bumped at checkout; give that use back
  await step("coupon", async () => {
    if (!order.coupon_code) return;
    const { data: coupon } = await client
      .from("coupons")
      .select("id, used_count")
      .eq("code", order.coupon_code)
      .maybeSingle();
    if (!coupon) return;
    await client
      .from("coupons")
      .update({ used_count: Math.max(0, Number(coupon.used_count ?? 0) - 1) })
      .eq("id", coupon.id);

    /* …and drop the per-account redemption, otherwise a cancel would burn the
       customer's one use of a once-per-account coupon. */
    await client.from("coupon_redemptions").delete().eq("order_id", order.id);
  });

  /* 3b. money that came out of the wallet goes back in. place_order() debited
         it with kind 'order'; no wallet debit means nothing to refund. */
  await step("wallet", async () => {
    const used = Number(order.wallet_used ?? 0);
    if (used <= 0 || !order.user_id) return;
    const { error } = await client.rpc("wallet_apply", {
      p_user: order.user_id,
      p_kind: "refund",
      p_amount: used,
      p_order: order.id,
      p_order_no: order.order_no,
      p_note: `অর্ডার বাতিল — ওয়ালেট ফেরত (${order.order_no})`,
    });
    if (error) throw error;
  });

  // 4. tell the customer, then every seller who had a share in the order
  const note = reason.trim() || "অ্যাডমিনের সিদ্ধান্তে";
  if (order.user_id) {
    await step("notify:customer", () =>
      notify({
        userId: order.user_id,
        audience: "user",
        kind: "order",
        title: `অর্ডার ${order.order_no} বাতিল করা হয়েছে`,
        body: note,
        link: "/account/orders",
      })
    );
  }

  await step("notify:sellers", async () => {
    // Two plain reads instead of an embedded join: explicit, and the seller's
    // login id lives on `sellers.user_id`, not on the sub_order.
    const { data: shares } = await client
      .from("sub_orders")
      .select("seller_id")
      .eq("order_id", order.id);
    const sellerIds = [...new Set((shares ?? []).map((s) => s.seller_id).filter((v): v is string => !!v))];
    if (!sellerIds.length) return;

    const { data: sellerRows } = await client
      .from("sellers")
      .select("id, user_id")
      .in("id", sellerIds);
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
  });
}
