# AGRO — Security Audit (rev 16)

Scope: full read of `app/api/**`, `middleware.ts`, `lib/**`, `supabase/sql/01…28`,
storage policies, `next.config`, deploy config. Every finding below was confirmed
in source; findings that turned out to be already-fixed are listed at the bottom
so they are not re-litigated.

Legend — **C**ritical / **H**igh / **M**edium / **L**ow.
Status — **FIXED** (code + migration in this branch) / **N/A** (verified sound) /
**MANUAL** (needs a dashboard step, cannot be done in code).

---

## 1. Wallet — `25_coupons_referrals_wallet.sql`

| # | Sev | Finding | Evidence | Fix |
|---|-----|---------|----------|-----|
| W1 | **C** | `wallet_apply(p_user, p_kind, p_amount, …)` is `SECURITY DEFINER` and trusts `p_user`. No `auth.uid()` check, no caller check, no allow-list of kinds. 25 never revoked the implicit **PUBLIC** grant, so any signed-in browser could call `/rest/v1/rpc/wallet_apply` with **any** uuid and any amount. | `25:244-296`, no `revoke` for it anywhere; 28 explicitly leaves wallet untouched | Guard inside the function + revoke from `public, anon, authenticated` (service key only) |
| W2 | **C** | `p_kind` was caller-chosen, so a caller could label a self-credit `'admin'` — fabricating an audit trail. | `25:281` inserts `p_kind` verbatim | Server-hardened allow-list; `'admin'` only when the actor is really an admin |
| W3 | **H** | `place_order(p_user, …)` is callable by `anon`+`authenticated` and debits `p_user`'s wallet for `p_wallet`. A browser could spend **another** user's balance. | `25:1104` grants `anon, authenticated`; `25:909-916` reads spends `p_user` | Guard: `p_user` must equal `auth.uid()`, or be the caller's own guest order, or come from the service key |
| W4 | **H** | `apply_referral(p_user, p_code)` callable by `authenticated`; could attach a referral to **another** account. | `25:1108` grant; body has no owner check | Guard: `p_user = auth.uid()` unless service key |
| W5 | **M** | No constraint prevents a double ledger row for the same `(order, kind)` other than referrals. | only `wallet_transactions_referral_once` exists | Add unique index for `kind in ('order','refund')` |
| W6 | **M** | `wallet_apply` accepts any amount incl. `numeric` overflow path; balance column is `numeric(12,2)` but the add is unchecked → raw overflow error instead of a clean refusal. | `25:272-283` | Range check + `numeric(12,2)` ceiling |

Verified sound: row lock on `profiles … for update` (no lost update), balances
can never go negative (`WALLET_INSUFFICIENT`), every move writes a ledger row,
`wallet_transactions` has RLS + own-rows-only select, `GET /api/wallet` is
read-only. `credit_referral` is trigger-only (`on_order_delivered`).

## 2. Payments

| # | Sev | Finding | Evidence | Fix |
|---|-----|---------|----------|-----|
| P1 | **H** | `trxMatches()` returned **true** when the configured regex fails to compile — a broken admin pattern silently disables TrxID validation. | `payments/submit:47-52` (`catch { return true }`) | Fail **closed**: invalid pattern rejects the submission and logs |
| P2 | **H** | No duplicate-TrxID check. The same transaction reference could be reported on several orders/subscriptions. | `submit:132-141` writes `payment_ref` unconditionally | `payment_refs` table + unique indexes; a claim that loses the race is refused |
| P3 | **M** | The write was not conditional on the row still being unpaid, so two submissions race and the later one wins. | `.update(...).eq("id", id)` with no status guard | Conditional update + idempotency key |

Verified sound: `orders` approval requires `orders.write` and is conditional on
the previous status (`foisal/orders:100-150`); premium approval requires
`premium.manage`, flips only a `pending` row, and writes an audit entry
(`foisal/premium-subscriptions:110-170`); the customer never sends `payment_status`
(`submit` only writes `payment_ref`).

## 3. CCTV / live stream

| # | Sev | Finding | Evidence | Fix |
|---|-----|---------|----------|-----|
| C1 | **H** | Viewer cap is check-then-insert: `viewerCapReached()` counts, then a **separate** insert mints the session. N parallel requests all pass the count. | `watch-rights:150-164` then `stream/token:88-100` | Atomic RPC `stream_reserve_slot()` — one advisory-lock transaction, re-counts and inserts |
| C2 | **M** | Device limit is read-then-upsert with no lock; two new devices racing both pass `known.length >= deviceLimit`. | `watch-rights:107-135` | Atomic RPC `premium_device_register()` |
| C3 | **M** | Expired `stream_tokens` rows are never deleted → the viewer count and table grow forever. | no delete/prune anywhere | `stream_prune_tokens()` + call it from the reserve RPC |
| C4 | **L** | Token issuance is rate-limited per IP only (`x-forwarded-for`), trivially rotated by an attacker with many IPs; acceptable because the cap is enforced in the DB. | `stream/token:29-38` | Not changed — documented (DB cap is the real control) |

Verified sound: JWT is HS256, 5-minute TTL, issuer+audience pinned, `jti` is
checked against a live row on every playlist request (`stream/auth`), camera id
and `stream_key` are both verified, RTSP credentials never leave the server,
`stream_tokens`/`premium_devices` have RLS and no client policy, trial fingerprint
is server-computed (no client `hint`), `cameras.is_premium=false` is the only
public path.

## 4. Storage

| # | Sev | Finding | Evidence | Fix |
|---|-----|---------|----------|-----|
| S1 | **H** | `complaint-photos` is created `public = true` and is in the `"public image read"` policy for `anon`. Every customer complaint photo — often a photo of a damaged or private item — is readable by anyone with the URL. | `09:40`, `09:52-60` (and again in `14:36`) | Bucket → private, removed from the public-read policy, owner+staff read policy, signed URLs |
| S2 | **H** | `/api/upload` returns `getPublicUrl()` for **every** bucket, so a complaint photo is handed to the browser as a permanent public link that keeps working even after the bucket is made private (public URL still resolves for `public` buckets only — but the stored value in `complaints.photos` is that permanent URL). | `upload/route.ts:196` | Private buckets return a **path**, plus a short-lived signed URL for immediate preview |
| S3 | **M** | `complaints.photos` stores those URLs; historical rows keep pointing at public links. | `05:184` | Migration rewrites stored values to paths; read path signs on demand |
| S4 | **L** | Upload validates MIME + magic bytes + size + namespaces the path by user id — sound. But `SELLER_BUCKETS` trusts `sellers.status='approved'` only, not `is_active`; a suspended seller could still write. | `upload:60-70` | Add `is_active` check |

Verified sound: path is `${user.id}/…` (no traversal, no cross-user overwrite),
`upsert:false`, random filename, fixed extension from the sniffed type, bucket
MIME + size limits as second line, `review-photos`/`avatars` intentionally public.

## 5. Application-wide

| # | Sev | Finding | Evidence | Fix |
|---|-----|---------|----------|-----|
| A1 | **M** | `payments/submit` accepted a `TrxID` for a **guest** order by matching only the phone number — an attacker who knows an order number and phone can pre-claim a payment reference. | `submit:96-104` | Keep (it is the documented guest flow) but now the claim is idempotent + unique, so it cannot be used twice, and a claim is only accepted while unpaid |
| A2 | **M** | `next.config` `images.remotePatterns` / CSP allow `*.supabase.co` — fine, but **no** `connect-src` for the stream host; verified CSP is set per request in middleware. | `middleware.ts` CSP block | N/A — CSP already generated per request with a nonce; verified no `unsafe-eval` in production |
| A3 | **L** | `login_attempts` has RLS enabled but no explicit policy → only the service role may write, which is what the code does. Confirmed no client read. | `08:52` list, no policy | N/A |
| A4 | **L** | `audit_log` was append-only but `authenticated` still held INSERT before 28; 28 revoked. | `28:301` | N/A (already fixed) |

Verified sound across the app: middleware guards + per-page re-check
(`canOpenPanelPath`), every mutating route passes `requirePermission` or
`currentUser` (checked by `scripts/security-scan.mjs`), `safeNextPath` blocks
open redirects, `jsonLdScript` escapes JSON-LD, `sanitizeText` on all
user-supplied strings, upload magic-byte sniffing, service key never imported by
a client component (scan enforces), `SUPABASE_SECRET_KEY` server-only.

## Dependencies

`npm audit` result in the PR body. Anything that cannot be fixed without a
breaking major bump is listed there rather than silently upgraded.

---

## Previously reported, re-verified as already fixed (not touched)

Stream `?t=` verification (#2 rev 15) · mediamtx read auth (#3) · go2rtc API
lockdown (#4) · trial `hint` removal (#5) · `cam/token` parity (#6) · JSON-LD
escaping (#7) · review login (#8) · seller product guard (#9) · guest
subscription admin-only (#10) · login-help enumeration (#11) · `chat_claim`
actor (#12) · `SUPABASE_SECRET_KEY` (#13) · team role save + panel access
(rev 16 earlier) · email handle as display name.
