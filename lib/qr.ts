import QRCode from "qrcode";
import { site } from "./site";

/* ==========================================================================
   lib/qr.ts — QR codes that actually scan off paper
   --------------------------------------------------------------------------
   The label's QR used to be rendered with `margin: 0` into a 104 px box. A QR
   code needs a quiet zone — four modules of empty white on every side — or the
   scanner cannot find the finder patterns, and a 26 mm print with no quiet
   zone is exactly the "I scan it and nothing happens" case.

   So every QR in the app is rendered here, with:

     • `margin: 3`  — a real quiet zone, included in the image itself so the
       white ring survives printing even on a coloured label
     • `width: 512` — rendered large, then scaled down by CSS. Vector-sharp
       when printed, and the modules stay square at any paper size
     • EC level M   — 15% damage tolerance: a crease or a thumbprint on the
       box still scans, without making the matrix denser than it needs to be

   The URL stays short (site origin + 32-char token) because every extra
   character adds modules and shrinks each one on paper.
   ========================================================================== */

export type QrOptions = {
  /** Dark modules. Default pure black — best contrast for cheap scanners. */
  dark?: string;
  /** Light modules + quiet zone. Default pure white. */
  light?: string;
  /** Pixel size of the rendered SVG. Default 512. */
  width?: number;
};

export async function qrSvg(data: string, options: QrOptions = {}): Promise<string> {
  const { dark = "#000000", light = "#ffffff", width = 512 } = options;
  const svg = await QRCode.toString(data, {
    type: "svg",
    // The quiet zone is part of the spec, not decoration.
    margin: 3,
    width,
    errorCorrectionLevel: "M",
    color: { dark, light },
  });

  /* `qrcode` writes width="512" height="512" on the element, so the image
     never shrinks to the box it is placed in — it overflows and the label ends
     up printing a cropped QR, which is the one shape a scanner cannot read.
     Swapping the pixel size for a percentage keeps the viewBox (so the modules
     stay square at any paper size) and lets CSS do the sizing. */
  return svg.replace(/\swidth="\d+"\sheight="\d+"/, ' width="100%" height="100%"');
}

/**
 * The absolute URL a printed QR should carry.
 *
 * `resolveSiteUrl()` already prefers NEXT_PUBLIC_SITE_URL, then Vercel's
 * production hostname, so a label printed on production points at production
 * rather than at the preview deployment that happened to build it. Trailing
 * slashes are stripped because `/p/abc/` is a different route.
 */
export function scanUrlFor(path: string): string {
  return `${site.url.replace(/\/+$/, "")}${path}`;
}
