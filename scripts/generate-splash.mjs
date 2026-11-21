#!/usr/bin/env node
/**
 * scripts/generate-splash.mjs
 * ---------------------------------------------------------------------------
 * Regenerates the iOS launch images in public/splash/.
 *
 * Safari will only use an apple-touch-startup-image when the media query matches
 * a device exactly, so we render one PNG per common iPhone/iPad size. The
 * matching <link> tags live in app/layout.tsx (SPLASH array) — keep the two
 * lists in sync if you add a device.
 *
 *   node scripts/generate-splash.mjs
 *
 * Requires `sharp` (already a Next.js dependency).
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SIZES = [
  [1290, 2796],
  [1179, 2556],
  [1284, 2778],
  [1170, 2532],
  [1125, 2436],
  [1242, 2688],
  [828, 1792],
  [750, 1334],
  [1536, 2048],
  [1668, 2388],
  [2048, 2732],
];

const OUT = path.join(process.cwd(), "public", "splash");

function svg(w, h) {
  const r = Math.min(w, h) * 0.13;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="#111312"/>
  <circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="#1f7a4d"/>
  <text x="50%" y="${h / 2 + r * 0.38}" font-family="sans-serif"
        font-size="${r * 1.2}" fill="#ffffff" text-anchor="middle">🌿</text>
</svg>`;
}

await mkdir(OUT, { recursive: true });

for (const [w, h] of SIZES) {
  const file = path.join(OUT, `splash-${w}x${h}.png`);
  await sharp(Buffer.from(svg(w, h)))
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log("wrote", path.relative(process.cwd(), file));
}
