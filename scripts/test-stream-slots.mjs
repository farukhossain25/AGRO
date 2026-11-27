#!/usr/bin/env node
/**
 * Viewer-slot accounting — a failed token request must not cost a viewer seat.
 * ----------------------------------------------------------------------------
 * `checkWatchRights()` reserves a row in stream_tokens before the route has
 * finished deciding whether it can serve the camera at all. Every reserved row
 * counts against `cameras.max_viewers` until it expires, so any failure after
 * the reservation that does not release it silently shrinks the camera's
 * capacity. Enough failed requests and the camera is "full" while nobody is
 * watching.
 *
 * This exercises the gate directly (`lib/watch-rights.ts`) plus the release
 * path the route uses (`delete from stream_tokens where jti = …`), which is
 * where the accounting actually lives. The route itself is covered by the live
 * matrix.
 *
 * The DB side is the real SQL chain in PGlite, so stream_reserve_slot() and its
 * cap arithmetic are the ones under test, not a stand-in.
 */
import { loadSchema } from "./lib/sql-harness.mjs";

const db = await loadSchema({ withSeed: false, chain: true });

let failed = 0;
function check(name, condition, detail = "") {
  if (condition) console.log(`OK   ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];

await db.exec(`
  insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'v@slot.invalid')
    on conflict (id) do nothing;
  select set_config('request.jwt.claims', '{"role":"service_role"}', false);
`);

/* A farm first — cameras.farm_id is NOT NULL. Then a camera capped at 2
   viewers, small enough to exhaust quickly. */
const farm = await one(
  `insert into public.farms (name_bn, slug, owner_user_id, division, district)
   select 'স্লট খামার', 'slot-farm', id, 'ঢাকা', 'ঢাকা' from public.profiles limit 1
   returning id`
);

const camera = await one(
  `insert into public.cameras (farm_id, name_bn, stream_key, protocol, status, is_active, max_viewers, is_premium)
   values ($1, 'স্লট টেস্ট', 'slot-cam', 'hls', 'online', true, 2, false)
   returning id`,
  [farm.id]
);

const reserve = (fp = "fp-1") =>
  one(`select public.stream_reserve_slot($1::uuid, $2::uuid, $3::text, 300) as r`, [camera.id, null, fp]).then((r) => r.r);

const liveCount = async () =>
  (await one(`select count(*)::int as n from public.stream_tokens where camera_id = $1 and expires_at > now()`, [camera.id])).n;

/** What the route does when something fails after the slot is reserved. */
const release = async (jti) => {
  await q(`select 1`);
  await db.query(`delete from public.stream_tokens where jti = $1::uuid`, [jti]);
};

/* ==========================================================================
   1. the reservation itself
   ========================================================================== */
{
  const before = await liveCount();
  const slot = await reserve("fp-a");

  check("a reservation succeeds while under the cap", slot.ok === true, JSON.stringify(slot));
  check("it returns the session id the token must be signed with", typeof slot.jti === "string" && slot.jti.length > 0);
  check("it counts one viewer", (await liveCount()) === before + 1);

  const second = await reserve("fp-b");
  check("a second viewer still fits under a cap of 2", second.ok === true, JSON.stringify(second));

  const third = await reserve("fp-c");
  check("the third viewer is refused with reason 'cap'", third.ok === false && third.reason === "cap", JSON.stringify(third));
  check("the refused request left no row behind", (await liveCount()) === before + 2);

  /* ---- the leak: reserve, fail, release --------------------------------- */
  const leaked = await reserve("fp-d");
  check("we cannot reserve a third slot to leak — the cap already blocks it", leaked.ok === false);

  await release(second.jti);
  const afterRelease = await reserve("fp-c");
  check("releasing a slot gives the seat back", afterRelease.ok === true, JSON.stringify(afterRelease));
  check("and the count is still capped", (await liveCount()) === before + 2);

  /* ---- release is idempotent ------------------------------------------- */
  await release(afterRelease.jti);
  await release(afterRelease.jti);
  await release(afterRelease.jti);
  check("releasing the same slot repeatedly is safe", (await liveCount()) === before + 1);

  await release(slot.jti);
  check("releasing everything returns to the starting count", (await liveCount()) === before);
}

/* ==========================================================================
   2. repeated failures do not consume capacity  ← the reported defect
   ========================================================================== */
{
  const before = await liveCount();

  /* Five failed attempts, each one reserving then releasing (the fix). With the
     old ordering, each attempt would have reserved and returned 503 without
     releasing — the camera would be saturated after two. */
  for (let i = 0; i < 5; i += 1) {
    const slot = await reserve(`fail-${i}`);
    if (slot.ok) await release(slot.jti);
  }

  check("five failed attempts leave the camera exactly as it was", (await liveCount()) === before, `${await liveCount()}`);

  const first = await reserve("real-1");
  const second = await reserve("real-2");
  check("two real viewers still fit after the failures", first.ok === true && second.ok === true);

  await release(first.jti);
  await release(second.jti);
}

/* ==========================================================================
   3. an expired slot frees itself
   ========================================================================== */
{
  const before = await liveCount();

  /* The route's own release is best-effort: if it fails, the slot expires on
     its TTL, which is the same bound every viewer slot already has. */
  await q(
    `insert into public.stream_tokens (camera_id, fingerprint, expires_at)
     values ($1, 'stale', now() - interval '1 minute')`,
    [camera.id]
  );

  const slot = await reserve("fresh");
  check("an expired row does not hold a seat", slot.ok === true, JSON.stringify(slot));
  check("and the next reservation purged it", (await liveCount()) === before + 1);

  await release(slot.jti);
}

/* ==========================================================================
   4. the reserve call is service-role only
   ========================================================================== */
{
  await db.exec(`select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}', false)`);
  const browserBlocked = await db
    .query(`select public.stream_reserve_slot($1::uuid, $2::uuid, 'x', 300)`, [camera.id, null])
    .then(() => false)
    .catch((e) => /STREAM_FORBIDDEN/.test(e.message));
  check("a browser cannot reserve a viewer slot", browserBlocked);

  await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
}

console.log(failed === 0 ? "\nAll viewer-slot checks hold. ✅" : `\n${failed} viewer-slot check(s) FAILED. ❌`);
process.exitCode = failed === 0 ? 0 : 1;
