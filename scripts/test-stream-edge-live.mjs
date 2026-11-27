#!/usr/bin/env node
/**
 * Live CCTV authorization matrix
 * ----------------------------------------------------------------------------
 * `test-stream-auth.mjs` pins the pure logic. This one boots the real Next
 * build against a stub PostgREST and drives /api/stream/auth with every token
 * shape and every failure mode, because that is the code the edge actually
 * calls — and the two defects this file guards were both in the wiring, not in
 * the crypto:
 *
 *   • proxy mode sends the token as X-Stream-Token; the route read only the URL
 *   • the camera-key check was `key && db.key && key !== db.key`, which skipped
 *     itself whenever either side was missing or empty
 *
 * Skipped automatically when no build exists or the port is busy — it needs
 * `npm run build` first. `npm run verify` runs after build in CI order, so the
 * check is explicit rather than silent: it FAILS if `next start` never answers,
 * and says exactly what to run.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import { existsSync } from "node:fs";

const MOCK_PORT = 54560;
const APP_PORT = 3260;
const CAM_A = "11111111-1111-4111-8111-111111111111";
const CAM_B = "22222222-2222-4222-8222-222222222222";
const JTI = "jti-live-1";

let failed = 0;
function check(name, condition, detail = "") {
  if (condition) console.log(`OK   ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

if (!existsSync(".next")) {
  console.error("FAIL no production build — run `npm run build` first");
  process.exit(1);
}

process.env.STREAM_TOKEN_SECRET = "0123456789abcdef0123456789abcdef";
const { signStreamToken } = await import("../lib/stream-auth.ts");

const tokenFor = (camera, overrides = {}) =>
  signStreamToken({ sub: "u1", cam: camera, jti: JTI, mode: "premium", ...overrides });

/* ---- stub that can change its mind between requests -------------------- */
let cameraState = { stream_key: "cam-a", is_active: true, status: "online" };
let sessionState = { camera_id: CAM_A, expired: false };

const mock = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname.replace("/rest/v1/", "");
  const send = (body) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (path === "stream_tokens") {
    return send({
      jti: JTI,
      camera_id: sessionState.camera_id,
      expires_at: new Date(Date.now() + (sessionState.expired ? -1000 : 300_000)).toISOString(),
    });
  }
  if (path === "cameras") return send({ id: CAM_A, ...cameraState });
  return send([]);
});

await new Promise((resolve) => mock.listen(MOCK_PORT, "0.0.0.0", resolve));

const app = spawn(
  "npx",
  ["next", "start", "-p", String(APP_PORT), "-H", "0.0.0.0"],
  {
    env: {
      ...process.env,
      SUPABASE_SECRET_KEY: "test_secret_value_for_local_only",
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test_anon",
      SUPABASE_DEV_USER_ID: "99999999-9999-4999-8999-999999999999",
    },
    stdio: "ignore",
  }
);

/** Wait for the server, up to ~40 s. */
async function ready() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${APP_PORT}/api/stream/auth?path=/hls/cam-a/index.m3u8`);
      if (res.status) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const base = `http://127.0.0.1:${APP_PORT}/api/stream/auth`;
const hit = async (query, headers = {}) => {
  const res = await fetch(`${base}${query}`, { headers });
  const body = await res.text();
  return { status: res.status, body };
};
const reasonOf = (text) => {
  try {
    return JSON.parse(text).reason ?? "-";
  } catch {
    return "-";
  }
};

try {
  if (!(await ready())) {
    console.error(`FAIL next start never answered on :${APP_PORT}`);
    process.exitCode = 1;
  } else {
    const good = await tokenFor(CAM_A);
    const otherCam = await tokenFor(CAM_B);

    /* ---- 1. the header transport (proxy mode) ------------------------- */
    {
      const noToken = await hit(`?path=${encodeURIComponent("/hls/cam-a/seg-0.ts")}`);
      check("proxy segment, no token at all → 401", noToken.status === 401, `${noToken.status}`);

      const withHeader = await hit(`?path=${encodeURIComponent("/hls/cam-a/seg-0.ts")}`, {
        "x-stream-token": good,
      });
      check("proxy segment with X-Stream-Token → 204", withHeader.status === 204, `${withHeader.status} ${withHeader.body}`);

      const emptyHeader = await hit(`?path=${encodeURIComponent("/hls/cam-a/seg-0.ts")}`, {
        "x-stream-token": "",
      });
      check("an empty X-Stream-Token does not authorize → 401", emptyHeader.status === 401, `${emptyHeader.status}`);

      const junkHeader = await hit(`?path=${encodeURIComponent("/hls/cam-a/seg-0.ts")}`, {
        "x-stream-token": "not.a.jwt",
      });
      check("a garbage X-Stream-Token → 401", junkHeader.status === 401, `${junkHeader.status}`);
    }

    /* ---- 2. direct mode, URL transports ------------------------------- */
    {
      const q = await hit(`?path=${encodeURIComponent("/hls/cam-a/index.m3u8")}& t=${good}`.replace("& t", "&t"));
      check("direct playlist with ?t= → 204", q.status === 204, `${q.status} ${q.body}`);

      const nested = await hit(`?path=${encodeURIComponent(`/hls/cam-a/seg-7.ts?t=${good}`)}`);
      check("direct segment with the token inside ?path= → 204", nested.status === 204, `${nested.status} ${nested.body}`);

      const llhls = await hit(`?path=${encodeURIComponent(`/hls/cam-a/ll-hls/part-3.m4s?t=${good}`)}`);
      check("LL-HLS part is authorized like any other resource → 204", llhls.status === 204, `${llhls.status}`);
    }

    /* ---- 3. rejection matrix ------------------------------------------ */
    {
      /* Two independent layers both refuse this, and which one speaks first
         depends on whether the session row still points at camera A (it does
         here, so the session check answers first, 401). Either refusal is
         correct — what must never happen is a 2xx. */
      const cross = await hit(`?path=${encodeURIComponent(`/hls/cam-a/index.m3u8?t=${otherCam}`)}`);
      check(
        "camera B's token cannot open camera A → refused",
        cross.status === 401 || cross.status === 403,
        `${cross.status} ${reasonOf(cross.body)}`
      );

      const tampered = (await tokenFor(CAM_A)).replace(/.$/, (c) => (c === "A" ? "B" : "A"));
      const bad = await hit(`?path=${encodeURIComponent(`/hls/cam-a/index.m3u8?t=${tampered}`)}`);
      check("a tampered signature → 401", bad.status === 401, `${bad.status}`);
    }

    /* ---- 4. revocation (session row) ---------------------------------- */
    {
      const live = await tokenFor(CAM_A);
      const before = await hit(`?path=${encodeURIComponent(`/hls/cam-a/index.m3u8?t=${live}`)}`);
      check("a live session authorizes", before.status === 204, `${before.status}`);

      sessionState = { camera_id: CAM_A, expired: true };
      const after = await hit(`?path=${encodeURIComponent(`/hls/cam-a/index.m3u8?t=${live}`)}`);
      check("an expired session is refused even with a valid token → 401", after.status === 401, `${after.status}`);

      sessionState = { camera_id: CAM_B, expired: false };
      const moved = await hit(`?path=${encodeURIComponent(`/hls/cam-a/index.m3u8?t=${live}`)}`);
      check("a session re-bound to another camera is refused → 401", moved.status === 401, `${moved.status}`);

      sessionState = { camera_id: CAM_A, expired: false };
    }

    /* ---- 5. key matching, FAIL CLOSED --------------------------------- */
    {
      const t = await tokenFor(CAM_A);

      const exact = await hit(`?path=${encodeURIComponent(`/hls/cam-a/index.m3u8?t=${t}`)}`);
      check("an exact key match authorizes → 204", exact.status === 204, `${exact.status}`);

      const mismatch = await hit(`?path=${encodeURIComponent(`/hls/cam-zzz/index.m3u8?t=${t}`)}`);
      check("a mismatched key is refused → 403", mismatch.status === 403, `${mismatch.status}`);

      /* No path= at all: the old code skipped the key check entirely here. */
      const noPath = await hit(`?t=${t}`);
      check("no requested key at all is refused, not skipped → 403", noPath.status === 403, `${noPath.status} ${reasonOf(noPath.body)}`);

      const emptyKey = await hit(`?path=${encodeURIComponent(`/hls//index.m3u8?t=${t}`)}`);
      check("an empty key in the path is refused → 403", emptyKey.status === 403, `${emptyKey.status}`);

      /* Camera with no stream key configured: previously the check short-
         circuited and ANY path authorized. */
      cameraState = { stream_key: null, is_active: true, status: "online" };
      const nullKey = await hit(`?path=${encodeURIComponent(`/hls/cam-a/index.m3u8?t=${t}`)}`);
      check("a camera with no configured key refuses everything → 503", nullKey.status === 503, `${nullKey.status} ${reasonOf(nullKey.body)}`);

      cameraState = { stream_key: "", is_active: true, status: "online" };
      const blankKey = await hit(`?path=${encodeURIComponent(`/hls/index.m3u8?t=${t}`)}`);
      check("a blank configured key refuses everything → 503", blankKey.status === 503, `${blankKey.status}`);

      cameraState = { stream_key: "cam-a", is_active: false, status: "online" };
      const inactive = await hit(`?path=${encodeURIComponent(`/hls/cam-a/index.m3u8?t=${t}`)}`);
      check("an inactive camera is refused → 403", inactive.status === 403, `${inactive.status}`);

      cameraState = { stream_key: "cam-a", is_active: true, status: "maintenance" };
      const maint = await hit(`?path=${encodeURIComponent(`/hls/cam-a/index.m3u8?t=${t}`)}`);
      check("a camera in maintenance is refused → 403", maint.status === 403, `${maint.status}`);

      cameraState = { stream_key: "cam-a", is_active: true, status: "online" };
    }

    /* ---- 6. nothing sensitive comes back ------------------------------ */
    {
      const responses = [
        await hit(`?path=${encodeURIComponent("/hls/cam-a/seg-0.ts")}`),
        await hit(`?path=${encodeURIComponent("/hls/cam-zzz/index.m3u8")}&t=${await tokenFor(CAM_A)}`),
      ];
      for (const res of responses) {
        check(
          `a refusal (${res.status}) leaks no credentials or keys`,
          !/rtsp:\/\/|password|cam-a|192\.168\.|10\.\d+\.\d+\.\d+/i.test(res.body),
          res.body.slice(0, 120)
        );
      }
    }
  }
} finally {
  app.kill("SIGTERM");
  mock.close();
  await new Promise((r) => setTimeout(r, 500));
}

console.log(
  failed === 0
    ? "\nLive CCTV authorization matrix holds. ✅"
    : `\n${failed} live CCTV check(s) FAILED. ❌`
);
process.exitCode = failed === 0 ? 0 : 1;
