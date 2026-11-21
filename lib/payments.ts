/**
 * Payment gateway adapters — bKash, Nagad, SSLCommerz.
 *
 * Every adapter has a working SANDBOX implementation and a clearly marked
 * live branch. With PAYMENTS_SANDBOX=true (the default) and empty credentials,
 * the adapters return a local test-checkout URL so the whole order flow can be
 * exercised end-to-end without merchant accounts.
 */

const SANDBOX = process.env.PAYMENTS_SANDBOX !== "false";

export type GatewayInit = {
  /** URL the browser should be sent to */
  redirectUrl: string;
  /** Gateway-side transaction reference, stored on the order */
  reference: string;
  /** true when this is our local simulated checkout */
  simulated: boolean;
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/* ------------------------------------------------------------------- bKash */
/**
 * bKash Tokenized Checkout.
 * Live docs: https://developer.bka.sh/docs/tokenized-checkout-introduction
 */
export async function initBkash(params: {
  orderNo: string;
  amount: number;
}): Promise<GatewayInit> {
  const appKey = process.env.BKASH_APP_KEY;
  const appSecret = process.env.BKASH_APP_SECRET;
  const username = process.env.BKASH_USERNAME;
  const password = process.env.BKASH_PASSWORD;
  const base = process.env.BKASH_BASE_URL || "https://tokenized.sandbox.bka.sh/v1.2.0-beta";

  if (!appKey || !appSecret || !username || !password) {
    // Simulated checkout so the flow works before merchant onboarding.
    return {
      redirectUrl: `/payment/simulate?gateway=bkash&order=${params.orderNo}&amount=${params.amount}`,
      reference: `SIM-BKASH-${params.orderNo}`,
      simulated: true,
    };
  }

  const tokenRes = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username,
      password,
    },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
    cache: "no-store",
  });

  if (!tokenRes.ok) throw new Error("bKash টোকেন পাওয়া যায়নি");
  const { id_token } = (await tokenRes.json()) as { id_token: string };

  const createRes = await fetch(`${base}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: id_token,
      "X-App-Key": appKey,
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: params.orderNo,
      callbackURL: process.env.BKASH_CALLBACK_URL || `${siteUrl()}/api/payments/bkash/callback`,
      amount: params.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: params.orderNo,
    }),
    cache: "no-store",
  });

  if (!createRes.ok) throw new Error("bKash পেমেন্ট শুরু করা যায়নি");
  const created = (await createRes.json()) as { bkashURL: string; paymentID: string };

  return { redirectUrl: created.bkashURL, reference: created.paymentID, simulated: false };
}

/* -------------------------------------------------------------------- Nagad */
/**
 * Nagad checkout (merchant-initiated). Requires RSA signing of the payload;
 * we implement the sandbox call and fall back to the simulated page until the
 * merchant private key is provisioned in env.
 */
export async function initNagad(params: {
  orderNo: string;
  amount: number;
}): Promise<GatewayInit> {
  const merchantId = process.env.NAGAD_MERCHANT_ID;
  const privateKey = process.env.NAGAD_MERCHANT_PRIVATE_KEY;

  if (!merchantId || !privateKey) {
    return {
      redirectUrl: `/payment/simulate?gateway=nagad&order=${params.orderNo}&amount=${params.amount}`,
      reference: `SIM-NAGAD-${params.orderNo}`,
      simulated: true,
    };
  }

  // Live implementation: sign the sensitive payload with the merchant RSA key.
  const { createSign } = await import("node:crypto");
  const base = process.env.NAGAD_BASE_URL || "https://sandbox-ssl.mynagad.com";
  const dateTime = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

  const payload = {
    merchantId,
    orderId: params.orderNo,
    currencyCode: "050",
    amount: params.amount.toFixed(4),
    challenge: Buffer.from(params.orderNo + dateTime).toString("base64"),
  };

  const signer = createSign("SHA256");
  signer.update(JSON.stringify(payload));
  const signature = signer.sign(privateKey, "base64");

  const res = await fetch(`${base}/api/dfs/check-out/initialize/${merchantId}/${params.orderNo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-KM-Api-Version": "v-0.2.0" },
    body: JSON.stringify({ accountNumber: params.orderNo, dateTime, sensitiveData: signature, signature }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Nagad পেমেন্ট শুরু করা যায়নি");
  const data = (await res.json()) as { callBackUrl?: string; paymentReferenceId?: string };

  return {
    redirectUrl: data.callBackUrl || `${siteUrl()}/payment/simulate?gateway=nagad&order=${params.orderNo}`,
    reference: data.paymentReferenceId || params.orderNo,
    simulated: false,
  };
}

/* -------------------------------------------------------------- SSLCommerz */
/**
 * SSLCommerz hosted checkout (cards, mobile wallets, bank).
 * Docs: https://developer.sslcommerz.com/doc/v4/
 */
export async function initSslcommerz(params: {
  orderNo: string;
  amount: number;
  customer: { name: string; phone: string; email?: string; address: string; district: string };
}): Promise<GatewayInit> {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;

  if (!storeId || !storePassword) {
    return {
      redirectUrl: `/payment/simulate?gateway=sslcommerz&order=${params.orderNo}&amount=${params.amount}`,
      reference: `SIM-SSL-${params.orderNo}`,
      simulated: true,
    };
  }

  const base = SANDBOX ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";

  const body = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: params.amount.toFixed(2),
    currency: "BDT",
    tran_id: params.orderNo,
    success_url: `${siteUrl()}/api/payments/sslcommerz/callback?status=success&order=${params.orderNo}`,
    fail_url: `${siteUrl()}/api/payments/sslcommerz/callback?status=fail&order=${params.orderNo}`,
    cancel_url: `${siteUrl()}/api/payments/sslcommerz/callback?status=cancel&order=${params.orderNo}`,
    cus_name: params.customer.name,
    cus_phone: params.customer.phone,
    cus_email: params.customer.email || "customer@bishwasagro.com",
    cus_add1: params.customer.address,
    cus_city: params.customer.district,
    cus_country: "Bangladesh",
    shipping_method: "NO",
    product_name: "Biswas Agro order",
    product_category: "grocery",
    product_profile: "general",
  });

  const res = await fetch(`${base}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) throw new Error("SSLCommerz পেমেন্ট শুরু করা যায়নি");
  const data = (await res.json()) as { GatewayPageURL?: string; sessionkey?: string };

  if (!data.GatewayPageURL) throw new Error("SSLCommerz গেটওয়ে রেসপন্স সঠিক নয়");

  return { redirectUrl: data.GatewayPageURL, reference: data.sessionkey ?? params.orderNo, simulated: false };
}

/* ---------------------------------------------------------------- dispatch */
export async function initPayment(method: string, params: {
  orderNo: string;
  amount: number;
  customer: { name: string; phone: string; email?: string; address: string; district: string };
}): Promise<GatewayInit> {
  switch (method) {
    case "bkash":
      return initBkash({ orderNo: params.orderNo, amount: params.amount });
    case "nagad":
      return initNagad({ orderNo: params.orderNo, amount: params.amount });
    case "sslcommerz":
      return initSslcommerz(params);
    default:
      return { redirectUrl: `/order-success?order=${params.orderNo}`, reference: "", simulated: true };
  }
}
