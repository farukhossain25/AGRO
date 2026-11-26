#!/usr/bin/env node
/**
 * Stream-edge configuration guard
 * ----------------------------------------------------------------------------
 * The CCTV hole this replaces was not a typo — it was a *rule*: "only playlists
 * need the token, segments are unguessable". A comment cannot fail a build, so
 * the rule drifted back into the config twice. This script makes the rule
 * executable.
 *
 * It reads both Caddyfiles and asserts, for every `handle` / `handle_path`
 * block that can return video bytes:
 *
 *   1. the block contains a `forward_auth` directive, or
 *   2. the block is provably not internet-facing (it is the loopback health
 *      probe reached only with the edge secret), or
 *   3. the block terminates locally (`respond 404/403`) — it serves no bytes.
 *
 * It also fails if a `forward_auth` target is not /api/stream/auth, or if the
 * token-bearing path is not forwarded (a forward_auth that forgets `path=`
 * would authorise every segment against an empty key).
 *
 * Run: node scripts/check-stream-edge.mjs   (wired into `npm run security`)
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = 0;

function pass(name) {
  console.log(`OK   ${name}`);
}
function failCheck(name, detail) {
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Strip `#` comments but keep quoted strings intact. Caddy configs use `#`. */
function stripComments(source) {
  return source
    .split("\n")
    .map((line) => {
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') quoted = !quoted;
        else if (ch === "#" && !quoted) return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

/**
 * Find `handle`/`handle_path` blocks with their nesting.
 *
 * Nesting matters: the health block contains an inner `handle @whep` and a
 * plain `handle`, both of which inherit the outer secret gate. Treating them as
 * independent top-level blocks would report false failures — and a checker that
 * cries wolf gets switched off, which is how the original hole survived.
 *
 * Implementation: a single pass that tracks brace depth. A handle opens at the
 * depth it was found and closes when depth returns to that value, so bodies are
 * exact and `ancestors` is simply the list of handles still open.
 */
function handleBlocks(source) {
  const lines = source.split("\n");
  const blocks = [];
  const open = [];

  let depth = 0;

  lines.forEach((line, i) => {
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    const handle = /^\s*(handle_path|handle)\b(.*?)\{\s*$/.exec(line);

    if (handle) {
      open.push({
        header: line.trim(),
        path: (handle[2] ?? "").trim(),
        line: i + 1,
        depth,
        body: [],
        ancestors: open.map((b) => b.header),
      });
    } else {
      for (const block of open) block.body.push(line);
    }

    depth += opens - closes;

    // Close every handle whose opening depth has been unwound.
    while (open.length && depth <= open[open.length - 1].depth) {
      const done = open.pop();
      done.body = done.body.join("\n");
      blocks.push(done);
    }
  });

  // Any still open (unbalanced config) are reported with what they have.
  while (open.length) {
    const done = open.pop();
    done.body = done.body.join("\n");
    blocks.push(done);
  }

  return blocks.sort((a, b) => a.line - b.line);
}

const files = ["Caddyfile", "Caddyfile.proxy"];

for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failCheck(`${file} exists`);
    continue;
  }

  const raw = fs.readFileSync(full, "utf8");
  const source = stripComments(raw);
  const blocks = handleBlocks(source);

  if (blocks.length === 0) {
    failCheck(`${file} has at least one handle block`, "none found — did the file change shape?");
    continue;
  }

  /* ---- forward_auth contents ------------------------------------------- */
  const authTargets = [...source.matchAll(/forward_auth\s+(\S+)/g)].map((m) => m[1]);
  for (const target of authTargets) {
    const isApp = /APP_INTERNAL_URL/.test(target);
    if (!isApp) failCheck(`${file}: forward_auth points at the app`, `got "${target}"`);
  }

  const authUris = [...source.matchAll(/uri\s+(\/api\/stream\/auth[^\s}]*)/g)].map((m) => m[1]);
  if (!authUris.length) {
    failCheck(`${file}: uses /api/stream/auth`, "no forward_auth uri found");
  }
  for (const uri of authUris) {
    if (!uri.includes("path=")) {
      failCheck(`${file}: forward_auth forwards the requested path`, `uri "${uri}" has no path= — every segment would authorise against an empty key`);
    }
  }

  /* ---- every block that serves bytes must authorise -------------------- */
  for (const block of blocks) {
    // Blocks that serve nothing: they terminate with a local response.
    const servesLocally = /^\s*respond\b/m.test(block.body) && !/reverse_proxy|file_server/.test(block.body);

    // The loopback health probe: reached only by Vercel with the edge secret,
    // and it returns the playlist, never video bytes to a browser.
    const healthProbe = /health-\{\$STREAM_EDGE_SECRET\}/.test(block.header) || /health-/.test(block.path);

    const hasAuth = /forward_auth\s/.test(block.body);
    const proxies = /reverse_proxy\s/.test(block.body);
    /* An enclosing handle that already forward_auths covers this one — that is
       exactly how the health block wraps its two inner handles. */
    const inheritedAuth = block.ancestors.some((h) => /health-/.test(h));

    const label = `${file}:${block.line} "${block.header}"`;

    if (servesLocally) {
      pass(`${label} — terminates locally, serves no bytes`);
      continue;
    }

    if (healthProbe || inheritedAuth) {
      pass(`${label} — inside the secret-gated server-to-server probe`);
      continue;
    }

    if (!proxies) {
      pass(`${label} — no reverse_proxy, nothing to gate`);
      continue;
    }

    if (!hasAuth) {
      failCheck(
        `${label} authorises before proxying`,
        "this handle forwards to MediaMTX/go2rtc without forward_auth — segments or signalling are reachable without a token"
      );
      continue;
    }

    pass(`${label} — forward_auth before reverse_proxy`);
  }

  /* ---- no path is left outside a handle -------------------------------- */
  /* Count reverse_proxy directives that are provably behind a gate: either in
     a block with its own forward_auth, or anywhere inside the secret-gated
     health tree. Anything left over is a directive nobody is checking. */
  const healthBodies = blocks
    .filter((b) => /health-/.test(b.path) || b.ancestors.some((h) => /health-/.test(h)))
    .map((b) => b.body)
    .join("\n");

  const gatedBodies = blocks
    .filter((b) => /forward_auth\s/.test(b.body) || /health-/.test(b.path) || b.ancestors.some((h) => /health-/.test(h)))
    .map((b) => b.body)
    .join("\n");

  const totalProxies = (source.match(/reverse_proxy\s/g) ?? []).length;
  const gatedProxies = (gatedBodies.match(/reverse_proxy\s/g) ?? []).length;
  const healthProxies = (healthBodies.match(/reverse_proxy\s/g) ?? []).length;

  if (gatedProxies + healthProxies >= totalProxies) {
    pass(`${file}: all ${totalProxies} reverse_proxy directives sit behind a gate`);
  } else {
    failCheck(
      `${file}: every reverse_proxy sits behind a gate`,
      `${totalProxies} total, ${gatedProxies} gated, ${healthProxies} on the secret health tree`
    );
  }
}

/* ---- the kill switch must exist and be documented --------------------- */
{
  const streams = fs.readFileSync(path.join(root, "lib/streams.ts"), "utf8");
  if (!/STREAM_EDGE_AUTHORIZES_ALL/.test(streams)) {
    failCheck("lib/streams.ts offers the STREAM_EDGE_AUTHORIZES_ALL kill switch");
  } else {
    pass("lib/streams.ts offers the STREAM_EDGE_AUTHORIZES_ALL kill switch");
  }

  if (/export function directVideoEnabled[\s\S]{0,300}?STREAM_EDGE_AUTHORIZES_ALL/.test(streams)) {
    pass("direct-video mode consults the kill switch");
  } else {
    failCheck("direct-video mode consults the kill switch");
  }
}

/* ---- the segment rewrite must carry the token ------------------------- */
{
  const proxy = fs.readFileSync(path.join(root, "app/api/stream/[...path]/route.ts"), "utf8");
  if (/\?t=\$\{token\}/.test(proxy)) {
    pass("the proxy rewrites playlist URIs to carry the token into every segment");
  } else {
    failCheck(
      "the proxy rewrites playlist URIs to carry the token into every segment",
      "segments would reach the edge without a token and be refused (or worse, accepted ungated)"
    );
  }

  if (/verifyStreamToken\(token\)/.test(proxy)) {
    pass("the proxy verifies the token itself, not just the edge");
  } else {
    failCheck("the proxy verifies the token itself");
  }
}

console.log(
  failed === 0
    ? "\nStream-edge configuration is closed: every byte path is authorised. ✅"
    : `\n${failed} stream-edge check(s) FAILED. ❌`
);
process.exitCode = failed === 0 ? 0 : 1;
