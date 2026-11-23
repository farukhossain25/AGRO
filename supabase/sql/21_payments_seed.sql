-- ============================================================================
-- 21_payments_seed.sql
-- ============================================================================
-- WHAT IT DOES
--   Seeds default payment methods (bKash, Nagad, Rocket, Upay, Bank Transfer,
--   Cash on Delivery) with PLACEHOLDER receiving numbers and Bangla
--   instructions. All methods start with is_active = false until the admin
--   sets real numbers and enables them in /foisal → মাধ্যম ও নম্বর
--   (payment methods).
--
-- WHEN TO RUN
--   After 20_payments_rls_storage.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

insert into public.payment_methods (
  code, name_bn, name_en, kind, account_type, account_number, account_name,
  bank_name, branch_name, instruction_bn, min_amount, max_amount,
  trx_pattern, requires_trx, requires_sender, is_active, sort_order
)
values
  (
    'bkash', 'বিকাশ', 'bKash', 'mfs', 'personal', '01700-000000', null,
    null, null,
    E'১. *247# ডায়াল করুন অথবা bKash অ্যাপ খুলুন।\n' ||
    E'২. Send Money-তে গিয়ে উপরের নম্বরে টাকা পাঠান।\n' ||
    E'৩. লেনদেন শেষে প্রাপ্ত TrxID ও আপনার নম্বর নিচে দিন।',
    10, 50000, '^[A-Za-z0-9]{8,12}$', true, true, false, 10
  ),
  (
    'nagad', 'নগদ', 'Nagad', 'mfs', 'personal', '01700-000000', null,
    null, null,
    E'১. *167# ডায়াল করুন অথবা Nagad অ্যাপ খুলুন।\n' ||
    E'২. Send Money-তে গিয়ে উপরের নম্বরে টাকা পাঠান।\n' ||
    E'৩. লেনদেন শেষে প্রাপ্ত TrxID নিচে দিন।',
    10, 50000, '^[A-Za-z0-9]{8,12}$', true, true, false, 20
  ),
  (
    'rocket', 'রকেট', 'Rocket', 'mfs', 'personal', '01700-000000', null,
    null, null,
    E'১. *322# ডায়াল করুন অথবা Rocket অ্যাপ খুলুন।\n' ||
    E'২. Send Money-তে গিয়ে উপরের নম্বরে টাকা পাঠান।\n' ||
    E'৩. TrxID নিচে দিন।',
    10, 50000, '^[A-Za-z0-9]{8,14}$', true, true, false, 30
  ),
  (
    'upay', 'উপায়', 'Upay', 'mfs', 'personal', '01700-000000', null,
    null, null,
    E'১. Upay অ্যাপ বা *268# থেকে উপরের নম্বরে Send Money করুন।\n' ||
    E'২. TrxID নিচে দিন।',
    10, 50000, '^[A-Za-z0-9]{8,14}$', true, true, false, 40
  ),
  (
    'bank', 'ব্যাংক ট্রান্সফার', 'Bank Transfer', 'bank', 'account', null, null,
    'Your Bank Name', 'Your Branch',
    E'উপরের ব্যাংক অ্যাকাউন্টে টাকা পাঠিয়ে রেফারেন্স নম্বর দিন।',
    100, 500000, '^[A-Za-z0-9-]{4,30}$', true, false, false, 50
  ),
  (
    'cod', 'ক্যাশ অন ডেলিভারি', 'Cash on Delivery', 'cod', 'personal', null, null,
    null, null,
    E'পণ্য হাতে পেয়ে ডেলিভারি ম্যানকে টাকা দিন।',
    100, 10000, null, false, false, false, 60
  )
on conflict (code) do update set
  name_bn         = excluded.name_bn,
  name_en         = excluded.name_en,
  kind            = excluded.kind,
  account_type    = excluded.account_type,
  account_number  = excluded.account_number,
  account_name    = excluded.account_name,
  bank_name       = excluded.bank_name,
  branch_name     = excluded.branch_name,
  instruction_bn  = excluded.instruction_bn,
  min_amount      = excluded.min_amount,
  max_amount      = excluded.max_amount,
  trx_pattern     = excluded.trx_pattern,
  requires_trx    = excluded.requires_trx,
  requires_sender = excluded.requires_sender,
  sort_order      = excluded.sort_order;
