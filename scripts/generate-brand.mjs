#!/usr/bin/env node
/**
 * scripts/generate-brand.mjs
 * ---------------------------------------------------------------------------
 * Derives every brand asset from the master logo
 * (assets/brand/bishwas-agro-logo.png — the file the owner supplied):
 *
 *   public/brand/logo-full.webp   the complete seal: emblem, বিশ্বাস এগ্রো,
 *                                 BISHWAS AGRO, gold ring and the tagline
 *   public/brand/logo-mark.webp   square emblem tile (leaf · sun · farmhouse ·
 *                                 paddy rows) — header mark, favicon, PWA icons
 *   public/icons/*.png            favicon / PWA / notification icons
 *   public/favicon.ico            16 + 32 + 48 px tab icon
 *   public/splash/splash-WxH.png  iOS launch screens (the size list mirrors
 *                                 SPLASH in app/layout.tsx — keep in sync)
 *
 *   node scripts/generate-brand.mjs
 *
 * Requires `sharp` (already a Next.js dependency). Re-run whenever the master
 * changes; everything below the "crops" section is derived, never hand-edited.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "assets", "brand", "bishwas-agro-logo.png");
const BRAND = path.join(ROOT, "public", "brand");
const ICONS = path.join(ROOT, "public", "icons");
const SPLASH = path.join(ROOT, "public", "splash");

/* ── crops (pixels in the 1536×1024 master) ──────────────────────────────
   The master is a round seal with transparent corners. The full lockup is the
   whole seal; the square mark is the scene at its top — leaf, sun, farmhouse
   and the paddy rows — because the wordmark band underneath is unreadable at
   40 px. `SCENE` is cut so the sun stays centred and the leaf tips of the
   logo's own ornament frame the top corners. */
const FULL = { left: 230, top: 8, width: 1056, height: 962 };
const SCENE = { left: 585, top: 140, width: 280, height: 272 };

/* Colours sampled from the master: the ring green of the badge, the cream of
   the tagline ribbon, the gold of the AGRO lettering, the leaf green. */
const GREEN = "#0a4d0a";
const CREAM = "#f7f6ec";
const SPLASH_TOP = "#083a0a";
const SPLASH_BOTTOM = "#0f5c17";

const log = (file) => console.log("wrote", path.relative(ROOT, file));

async function roundedMask(width, height, radius) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
       <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/>
     </svg>`
  );
}

/* A brand tile: solid green square with the emblem in a rounded plate. */
async function brandTile(size, tileRatio, radiusRatio = 0.24) {
  const tile = Math.round(size * tileRatio);
  const off = Math.round((size - tile) / 2);
  const mark = await sharp(path.join(BRAND, "logo-mark.webp"))
    .resize(tile, tile, { fit: "cover" })
    .png()
    .toBuffer();
  const plate = await sharp(mark)
    .composite([{ input: await roundedMask(tile, tile, Math.round(tile * radiusRatio)), blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: GREEN } })
    .composite([{ input: plate, left: off, top: off }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/* Multi-frame .ico with PNG frames (Vista+ browsers, 16–256 px). */
function ico(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const dir = Buffer.alloc(16 * frames.length);
  let offset = 6 + dir.length;
  frames.forEach((f, i) => {
    const o = i * 16;
    dir.writeUInt8(f.size >= 256 ? 0 : f.size, o);
    dir.writeUInt8(f.size >= 256 ? 0 : f.size, o + 1);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(f.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += f.png.length;
  });
  return Buffer.concat([header, dir, ...frames.map((f) => f.png)]);
}

/* ── 1. lockup + mark ─────────────────────────────────────────────────── */
await mkdir(BRAND, { recursive: true });
await mkdir(ICONS, { recursive: true });
await mkdir(SPLASH, { recursive: true });

/* The full seal keeps its transparent corners — it sits on the neumorphic
   surface in the footer and on the white splash plate, and a flattened copy
   would show a white rectangle around the round badge. The small rasters are
   flattened below because an icon cannot have soft edges. */
const fullPng = await sharp(SRC).extract(FULL).png().toBuffer();
const fullWebp = path.join(BRAND, "logo-full.webp");
await sharp(fullPng).resize({ width: 1200 }).webp({ quality: 92, effort: 6 }).toFile(fullWebp);
log(fullWebp);

/* The mark is a legible-at-40px square: scene only, square-cornered here —
   the rounded corners are drawn by the tile helpers below. `cover` on a 280
   × 272 crop means roughly 1.5% of the height is trimmed at the bottom, and
   the crop is chosen so that trim lands on field, never on the wordmark. */
const mark256 = await sharp(SRC)
  .flatten({ background: "#ffffff" })
  .extract(SCENE)
  .resize(512, 512, { fit: "cover", position: "top" })
  .png()
  .toBuffer();
const markPng = await sharp(mark256)
  .composite([{ input: await roundedMask(512, 512, 120), blend: "dest-in" }])
  .png()
  .toBuffer();
const markWebp = path.join(BRAND, "logo-mark.webp");
await sharp(markPng).webp({ quality: 92, effort: 6 }).toFile(markWebp);
log(markWebp);

/* ── 2. icons ─────────────────────────────────────────────────────────── */
const mark512 = markPng;
const iconFile = async (name, size, tileRatio, radiusRatio) => {
  const buf = await brandTile(size, tileRatio, radiusRatio);
  await sharp(buf).png({ compressionLevel: 9, palette: true, quality: 92, colours: 256, dither: 1 })
    .toFile(path.join(ICONS, name));
  log(path.join(ICONS, name));
};
await iconFile("icon-192.png", 192, 0.78);
await iconFile("icon-512.png", 512, 0.78);
await iconFile("apple-touch-icon.png", 180, 0.78);
/* Maskable: Android may crop to a circle of 80% — keep the plate inside it. */
await iconFile("maskable-512.png", 512, 0.56, 0.26);

/* Tab icon: the emblem scene edge to edge (no plate) so 16 px keeps every
   pixel. The cream plate keeps the sun and the paddy rows readable. */
const faviconBase = await sharp({ create: { width: 512, height: 512, channels: 3, background: CREAM } })
  .composite([{ input: markPng }])
  .png()
  .toBuffer();
const frames = [];
for (const size of [16, 32, 48]) {
  frames.push({ size, png: await sharp(faviconBase).resize(size, size, { kernel: "lanczos3" }).png().toBuffer() });
}
await writeFile(path.join(ROOT, "public", "favicon.ico"), ico(frames));
log(path.join(ROOT, "public", "favicon.ico"));

/* Notification badge: white silhouette of the emblem on transparent. The badge
   is a monochrome slot — a photograph of a farm would turn into noise, so the
   silhouette keeps the sun + field shape and drops the colour detail. */
{
  const flat = await sharp(SRC).flatten({ background: "#ffffff" }).extract(SCENE).resize(512, 512).png().toBuffer();
  const { data, info } = await sharp(flat).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4, 255);
  for (let p = 0; p < info.width * info.height; p++) {
    const i = p * 4;
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    /* the sky is flat blue and the sun is flat yellow — only the mid/dark
       greens (field, house, trees) become the white shape */
    out[p * 4 + 3] = lum < 150 ? 255 : 0;
  }
  const badge = path.join(ICONS, "badge-72.png");
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(72, 72)
    .png()
    .toFile(badge);
  log(badge);
}

/* ── 3. iOS launch screens ────────────────────────────────────────────── */
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
const fullMeta = await sharp(fullWebp).metadata();

for (const [w, h] of SIZES) {
  const plateW = Math.round(Math.min(w * 0.62, 760));
  const pad = Math.round(plateW * 0.06);
  const logoW = plateW - pad * 2;
  const logoH = Math.round((logoW * fullMeta.height) / fullMeta.width);
  const plateH = logoH + pad * 2;
  const left = Math.round((w - plateW) / 2);
  const top = Math.round(h * 0.45 - plateH / 2);
  const radius = Math.round(plateW * 0.09);

  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
       <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${SPLASH_TOP}"/><stop offset="1" stop-color="${SPLASH_BOTTOM}"/>
       </linearGradient></defs>
       <rect width="${w}" height="${h}" fill="url(#g)"/>
     </svg>`
  );
  const plate = await sharp({
    create: { width: plateW, height: plateH, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: await roundedMask(plateW, plateH, radius), blend: "dest-in" }])
    .png()
    .toBuffer();

  const file = path.join(SPLASH, `splash-${w}x${h}.png`);
  await sharp(bg)
    .composite([
      { input: plate, left, top },
      { input: await sharp(fullWebp).resize(logoW, logoH).png().toBuffer(), left: left + pad, top: top + pad },
    ])
    .png({ compressionLevel: 9, palette: true, quality: 90, colours: 256, dither: 1 })
    .toFile(file);
  log(file);
}
