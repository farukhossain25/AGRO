import { db } from "./db";
import type { Database } from "./database.types";
import type { PaymentMethodRow, PublicPaymentMethod } from "./types";

/* ==========================================================================
   Payment methods — the admin-managed receiving methods
   --------------------------------------------------------------------------
   This is the whole payment system: the owner adds/edits/deletes methods
   (bKash, Nagad, Rocket, Upay, bank account, cash on delivery) from the
   admin panel at /foisal/payment-methods. Each row carries the receiving
   number the customer sends money to, plus Bangla instructions shown on the
   checkout and payment pages.

   Orders record only `payment_method` (the method code) and
   `payment_status` (pending → paid). There is no manual TrxID verification
   engine: the customer sends money to the displayed number and the owner
   marks the order paid from the admin panel.
   ========================================================================== */

type MethodClient = Database["public"]["Tables"]["payment_methods"]["Row"];

/** Everything the storefront needs to render "send money to this number". */
export function toPublicMethod(row: MethodClient): PublicPaymentMethod {
  return {
    id: row.id,
    code: row.code,
    name_bn: row.name_bn,
    name_en: row.name_en,
    kind: row.kind,
    logo_url: row.logo_url,
    account_type: row.account_type,
    account_number: row.account_number,
    account_name: row.account_name,
    bank_name: row.bank_name,
    branch_name: row.branch_name,
    instruction_bn: row.instruction_bn,
    min_amount: Number(row.min_amount),
    max_amount: row.max_amount == null ? null : Number(row.max_amount),
    requires_trx: row.requires_trx,
    requires_sender: row.requires_sender,
    show_on_checkout: row.show_on_checkout,
  };
}

/** Active methods in display order — the checkout page's source of truth. */
export async function getActiveMethods(): Promise<PaymentMethodRow[]> {
  const { data, error } = await db()
    .from("payment_methods")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PaymentMethodRow[];
}

/** Active methods shaped for the storefront. */
export async function getPublicMethods(): Promise<PublicPaymentMethod[]> {
  const rows = await getActiveMethods();
  return rows.map(toPublicMethod);
}

/**
 * The footer's payment row — a SEPARATE read from the checkout list.
 *
 * `show_on_checkout = false` means "this method still takes orders, but keep
 * its logo out of the footer row" (a store that accepts a bank transfer but
 * does not want it advertised in the footer). Ordering is the admin's own
 * `sort_order`, which is what decides the first four (three on a phone) tiles.
 *
 * Read on every request by the storefront layout, so add / remove / reorder /
 * hide shows up on the next page load — no redeploy, no cache to bust.
 */
export async function getFooterPaymentMethods(): Promise<PublicPaymentMethod[]> {
  const { data, error } = await db()
    .from("payment_methods")
    .select("*")
    .eq("is_active", true)
    .eq("show_on_checkout", true)
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as MethodClient[]).map(toPublicMethod);
}

/** One method by its code (case-insensitive). Null when missing/inactive. */
export async function getMethodByCode(code: string): Promise<PaymentMethodRow | null> {
  const { data, error } = await db()
    .from("payment_methods")
    .select("*")
    .eq("code", code.trim().toLowerCase())
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as PaymentMethodRow | null) ?? null;
}

/** All rows including inactive ones — used by the admin panel. */
export async function listAllMethods(): Promise<PaymentMethodRow[]> {
  const { data, error } = await db()
    .from("payment_methods")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PaymentMethodRow[];
}

/** Create a payment method (admin panel "add"). */
export async function createMethod(
  input: Omit<MethodClient, "id" | "created_at" | "updated_at">
): Promise<PaymentMethodRow> {
  const { data, error } = await db()
    .from("payment_methods")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PaymentMethodRow;
}

/** Update a payment method (admin panel "edit"). */
export async function updateMethod(
  id: string,
  input: Partial<MethodClient>
): Promise<PaymentMethodRow> {
  const { data, error } = await db()
    .from("payment_methods")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PaymentMethodRow;
}

/** Delete a payment method (admin panel "delete"). */
export async function deleteMethod(id: string): Promise<void> {
  const { error } = await db().from("payment_methods").delete().eq("id", id);
  if (error) throw error;
}
