-- ============================================================================
-- 21_payments_seed.sql
-- ============================================================================
-- WHAT IT DOES
--   Seeds default payment methods (bKash, Nagad, Rocket, Upay, Bank Transfer,
--   Cash on Delivery) with PLACEHOLDER numbers and Bangla instructions.
--   All methods start with is_active = false until the admin sets real
--   numbers and enables them in /foisal/payments.
--
-- WHEN TO RUN
--   After 20_payments_rls_storage.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

insert into public.payment_methods (
  provider, display_name, display_name_bn, receiving_number, account_type,
  instructions_bn, instructions_en, min_amount, max_amount,
  requires_trx_id, requires_sender_number, requires_screenshot, trx_id_pattern,
  is_active, show_on_checkout, show_on_premium, sort_order
)
values
  (
    'bkash', 'bKash', 'বিকাশ', '01700-000000', 'personal',
    E'১. *247# ডায়াল করুন অথবা bKash অ্যাপ খুলুন।\n২. Send Money-তে গিয়ে উপরের নম্বরে টাকা পাঠান।\n৩. লেনদেন শেষে প্রাপ্ত TrxID ও আপনার নম্বর নিচে দিন।',
    'Dial *247# or open bKash app, Send Money to the number above, and enter your TrxID.',
    10, 50000, true, true, false, '^[A-Za-z0-9]{8,12}$', false, true, true, 10
  ),
  (
    'nagad', 'Nagad', 'নগদ', '01700-000000', 'personal',
    E'১. *167# ডায়াল করুন অথবা Nagad অ্যাপ খুলুন।\n২. Send Money-তে গিয়ে উপরের নম্বরে টাকা পাঠান।\n৩. লেনদেন শেষে প্রাপ্ত TrxID নিচে দিন।',
    'Dial *167# or open Nagad app, Send Money to the number above, and enter your TrxID.',
    10, 50000, true, true, false, '^[A-Za-z0-9]{8,12}$', false, true, true, 20
  ),
  (
    'rocket', 'Rocket', 'রকেট', '01700-000000', 'personal',
    E'১. *322# ডায়াল করুন অথবা Rocket অ্যাপ খুলুন।\n২. Send Money-তে গিয়ে উপরের নম্বরে টাকা পাঠান।\n৩. TrxID নিচে দিন।',
    'Dial *322# or open Rocket app, Send Money to the number above, and enter your TrxID.',
    10, 50000, true, true, false, '^[A-Za-z0-9]{8,14}$', false, true, true, 30
  ),
  (
    'upay', 'Upay', 'উপায়', '01700-000000', 'personal',
    E'১. Upay অ্যাপ বা *268# থেকে উপরের নম্বরে Send Money করুন।\n২. TrxID নিচে দিন।',
    'Send Money via Upay app or *268# and enter your TrxID.',
    10, 50000, true, true, false, '^[A-Za-z0-9]{8,14}$', false, true, true, 40
  ),
  (
    'bank', 'Bank Transfer', 'ব্যাংক ট্রান্সফার', null, 'account',
    E'উপরের ব্যাংক অ্যাকাউন্টে টাকা পাঠিয়ে রেফারেন্স নম্বর দিন এবং পেমেন্ট স্লিপের ছবি আপলোড করুন।',
    'Transfer to the bank account above, enter the reference number, and upload the slip.',
    100, 500000, true, false, true, '^[A-Za-z0-9-]{4,30}$', false, true, true, 50
  ),
  (
    'cod', 'Cash on Delivery', 'ক্যাশ অন ডেলিভারি', null, 'personal',
    E'পণ্য হাতে পেয়ে ডেলিভারি ম্যানকে টাকা দিন।',
    'Pay cash to the delivery rider when you receive your order.',
    100, 10000, false, false, false, '.*', false, true, false, 60
  );
