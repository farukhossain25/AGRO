/* ==========================================================================
   Seller sales & payout overview — the numbers behind /foisal/seller-sales
   --------------------------------------------------------------------------
   The marketplace takes its commission per sub_order, so "how much did this
   seller make" lives in sub_orders, not orders. Pure aggregation, no I/O:

     sold         = sub_orders delivered (products actually handed over)
     pending      = sub_orders received / packing / shipped
     owed         = seller_earning of delivered sub_orders
     payable      = owed minus what has already been paid out (seller_payouts)
     pending amt  = seller_earning still locked behind undelivered orders

   A cancelled sub_order is a dead row: counted nowhere, listed for the record.
   ========================================================================== */

export type SellerSalesOrder = {
  sub_no: string;
  status: string;
  subtotal: number;
  seller_earning: number;
  created_at: string;
};

export type SellerSalesProduct = {
  id: string;
  name_bn: string;
  approval_status: string;
  is_active: boolean;
  stock: number;
  price: number;
};

export type SellerSalesRow = {
  id: string;
  slug: string;
  name_bn: string;
  phone: string;
  status: string;
  commission_percent: number;
  payout_method: string | null;
  payout_number: string | null;
  created_at: string;
  sold: number;
  soldAmount: number;
  pending: number;
  owed: number;
  paidOut: number;
  payable: number;
  pendingAmount: number;
  liveProducts: number;
  pendingProducts: number;
  sub_orders: SellerSalesOrder[];
  products: SellerSalesProduct[];
};

export type SellerSalesSeller = {
  id: string;
  slug: string;
  name_bn: string;
  phone: string;
  status: string;
  commission_percent: number | string | null;
  payout_method: string | null;
  payout_number: string | null;
  created_at: string;
};

export type SellerSalesSub = {
  seller_id: string | null;
  sub_no: string;
  status: string;
  subtotal: number | string | null;
  commission: number | string | null;
  seller_earning: number | string | null;
  created_at: string;
};

export type SellerSalesPayout = { seller_id: string; amount: number | string | null; status: string };

export type SellerSalesProductRow = {
  id: string;
  seller_id: string | null;
  name_bn: string;
  approval_status: string;
  is_active: boolean;
  stock: number | string | null;
  price: number | string | null;
};

type Agg = {
  sold: number;
  soldAmount: number;
  pending: number;
  owed: number;
  pendingAmount: number;
  paidOut: number;
};

export function buildSellerSales(
  sellers: SellerSalesSeller[],
  subs: SellerSalesSub[],
  payouts: SellerSalesPayout[],
  products: SellerSalesProductRow[]
): SellerSalesRow[] {
  const agg = new Map<string, Agg>();
  const get = (id: string): Agg => {
    let a = agg.get(id);
    if (!a) {
      a = { sold: 0, soldAmount: 0, pending: 0, owed: 0, pendingAmount: 0, paidOut: 0 };
      agg.set(id, a);
    }
    return a;
  };
  for (const s of sellers) get(s.id);

  for (const sub of subs) {
    if (!sub.seller_id || sub.status === "cancelled") continue;
    const a = get(sub.seller_id);
    if (sub.status === "delivered") {
      a.sold += 1;
      a.soldAmount += Number(sub.subtotal ?? 0);
      a.owed += Number(sub.seller_earning ?? 0);
    } else {
      a.pending += 1;
      a.pendingAmount += Number(sub.seller_earning ?? 0);
    }
  }

  for (const p of payouts) {
    if (!p.seller_id) continue;
    get(p.seller_id).paidOut += Number(p.amount ?? 0);
  }

  const liveProducts = new Map<string, number>();
  const pendingProducts = new Map<string, number>();
  for (const p of products) {
    if (!p.seller_id) continue;
    if (p.approval_status === "pending") {
      pendingProducts.set(p.seller_id, (pendingProducts.get(p.seller_id) ?? 0) + 1);
    } else if (p.approval_status === "approved" && p.is_active) {
      liveProducts.set(p.seller_id, (liveProducts.get(p.seller_id) ?? 0) + 1);
    }
  }

  return sellers.map((s) => {
    const a = get(s.id);
    return {
      id: s.id,
      slug: s.slug,
      name_bn: s.name_bn,
      phone: s.phone,
      status: s.status,
      commission_percent: Number(s.commission_percent ?? 0),
      payout_method: s.payout_method,
      payout_number: s.payout_number,
      created_at: s.created_at,
      sold: a.sold,
      soldAmount: a.soldAmount,
      pending: a.pending,
      owed: a.owed,
      paidOut: a.paidOut,
      payable: Math.max(0, a.owed - a.paidOut),
      pendingAmount: a.pendingAmount,
      liveProducts: liveProducts.get(s.id) ?? 0,
      pendingProducts: pendingProducts.get(s.id) ?? 0,
      sub_orders: subs
        .filter((x) => x.seller_id === s.id && x.status !== "cancelled")
        .sort((x, y) => y.created_at.localeCompare(x.created_at))
        .slice(0, 8)
        .map((x) => ({
          sub_no: x.sub_no,
          status: x.status,
          subtotal: Number(x.subtotal ?? 0),
          seller_earning: Number(x.seller_earning ?? 0),
          created_at: x.created_at,
        })),
      products: products
        .filter((x) => x.seller_id === s.id)
        .sort((a2, b) => Number(b.price ?? 0) - Number(a2.price ?? 0))
        .slice(0, 6)
        .map((x) => ({
          id: x.id,
          name_bn: x.name_bn,
          approval_status: x.approval_status,
          is_active: x.is_active,
          stock: Number(x.stock ?? 0),
          price: Number(x.price ?? 0),
        })),
    };
  });
}
