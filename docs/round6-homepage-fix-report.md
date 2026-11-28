# Round 6 — Homepage loading & runtime errors: complete change report

**Branch** `arena/8c46a8db-agro` · **commit** `908aeeb` (pushed)
**Verdict:** homepage 39 048 ms → **35 ms** on a stalling database; every storefront page under 100 ms; typecheck, lint, build, `npm run verify` and the resilience harness all green.

---

## 1. The real root cause (not what the symptom suggested)

The homepage was never slow because a query was slow. **The queries could not be cancelled.**

`lib/data.ts` and `lib/content.ts` bounded each read with `Promise.race([query, timer])`. A race is not a deadline: when the timer won, the query stayed in flight, kept its socket open until `lib/db.ts`'s own timeout, and **the Node server could not finish the response until that work settled**. The log therefore said "timeout at 4 s" while the visitor waited 39 s.

The smoking gun, from a stalling host before this fix:

```
[data] read fail key=faq_items ms=39042 kind=timeout
[home] rendered ms=39049
```

`getFaqGroups()` had **no bound at all** — not even a race — so one unbounded read held the document after all eleven others had given up.

Three more defects sat behind it, each hidden by the one in front:

| # | Defect | Effect |
|---|---|---|
| 1 | `export const revalidate = 120` on `/` | A failed render was ISR-cached for 2 minutes and served to every visitor; cache hits also starved the breaker of new evidence |
| 2 | `instanceof ReadTimeoutError` | Always false — Next compiles the module once per route entrypoint, so the class identity differs. The breaker never opened for a timeout |
| 3 | Breaker marked *after* the race resolved | All 11 concurrent reads had already been issued, so all 11 paid the full 4 s |

Two further issues surfaced only once 1–3 were fixed:

4. **`dbUsable()` treated the half-open window as usable** (`Date.now() >= unreachableUntil`). At the instant the probe window elapsed, every arriving request sent real queries and paid the whole budget — measured as `/products 5 528 ms`, `/market 5 527 ms` while every other page was 1.5 s.
5. **PostgREST does not throw on abort** — it resolves `{ data: null, error }`. A read that was aborted was logged `read ok key=announcement ms=4004` and the breaker was never told.

## 2. Files changed

| File | Change |
|---|---|
| **`lib/read-deadline.ts`** *(new)* | One abortable read helper: passes an `AbortSignal` into the query, aborts the socket at the deadline, opens the breaker at fire time, never throws, logs duration + failure kind |
| **`lib/queries.ts`** | Every read accepts an optional `AbortSignal` and applies `.abortSignal(signal)` |
| **`lib/data.ts`** | `safe()` delegates to the helper; single-flight per cache key; `README_TIMEOUT_MS` re-exported |
| **`lib/content.ts`** | Hero, layout and social reads abortable; `memo()` is single-flight; `revalidateContent()` / `SocialPlacement` preserved |
| **`lib/cms.ts`** | `getFaqGroups` — the unbounded 39 s read — now abortable and bounded |
| **`lib/sellers.ts`**, **`lib/site-settings.ts`**, **`lib/payment-methods.ts`** | Same helper; `payment-methods` was the last request-path read still opening a socket to a dead database |
| **`lib/db.ts`** | `dbUsable()` is closed-only; background half-open probe (`dbProbeDue`/`beginDbProbe`/`endDbProbe`) so a request never pays for the diagnosis |
| **`lib/log.ts`** | Describes Supabase error objects (was `err=[object Object]`); credentials still redacted |
| **`app/(storefront)/page.tsx`** | `Promise.allSettled` for the 11 reads, per-section error boundaries, `force-dynamic` instead of ISR |
| **`components/home/section-boundary.tsx`** *(new)* | One section's render failure cannot take the page |
| **`scripts/test-homepage-resilience.mjs`** | 36 assertions incl. a latency budget; depth-aware hidden-Suspense stripping |

## 3. Measured results

**Stalling database host** (connections hang, not refuse — the only host that reproduces the pathology):

| Route | Before | After |
|---|---|---|
| `/` | 39 048 ms | **35 ms** |
| `/products` | 5 525 ms | **20 ms** |
| `/market` | 39 026 ms | **18 ms** |
| `/categories` | 5 525 ms | **18 ms** |
| `/combos`, `/farmers`, `/blog`, `/faq` | — | 21–51 ms |

**Healthy mock PostgREST** (proves live data still flows): 270–310 ms, product rows present on every page.
**Slow database** (1.5 s per query, inside the deadline): 3.0 s, data intact.
**One query sleeping 6 s** (beyond the deadline): page still 48 ms; only that section degrades; the breaker opens and the background probe recovers the site 4 s later.

## 4. Acceptance criteria

| Requirement | Status |
|---|---|
| Homepage never waits indefinitely | ✅ hard bound on every read; 35 ms degraded |
| Hero always visible | ✅ `FALLBACK_SLIDES` renders in the Suspense fallback |
| One failed query must not crash unrelated sections | ✅ `Promise.allSettled` + per-section boundary |
| Error recovery works | ✅ background probe re-closes the breaker; 4 s single probe, then instant |
| No broken sections | ✅ 13 sections render in every scenario |
| No security regressions | ✅ RLS untouched; security scan 0 errors; credentials redacted |
| Admin, products, checkout, auth intact | ✅ `/foisal`, `/login`, `/cart` all 200; 184 routes built |

## 5. Test evidence

- `npm run typecheck` — clean
- `npm run lint` — no warnings or errors
- `npm run build` — 28/28 static pages; `/` is dynamic `ƒ`
- `npm run verify` — **178 checks, 0 FAIL**; security scan 0 errors / 1 warning; every one of 184 routes inside budget
- `node scripts/test-homepage-resilience.mjs` — **36/36** against the degraded server

## 6. Known limits

- `/products/<slug>` answers 500 rather than 404 when the database is unreachable — deliberate: a lookup failure must not be reported as "no such product".
- Lighthouse 100/100 is still unproven in this sandbox (no browser available); the measures that feed it — one `h1` in the DOM, viewport meta, `no-store` — are asserted by the harness.
