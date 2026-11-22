import { fail, handleError, ok, requireUser } from "@/lib/api";
import { buildLabel } from "@/lib/parcels";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * GET /api/foisal/parcels/<orderNo>
 * Returns the label payload + an inline SVG QR (no client dependency, works
 * in print CSS and in <img src="data:image/svg+xml,…">).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ orderNo: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return fail("অনুমতি নেই", 403);

    const { orderNo } = await ctx.params;
    const result = await buildLabel(orderNo);
    if (!result) return fail("অর্ডার পাওয়া যায়নি", 404);

    const qr = await import("qrcode");
    const base = site.url;
    const scanUrl = `${base.replace(/\/$/, "")}/p/${result.token}`;

    const svg = await qr.toString(scanUrl, {
      type: "svg",
      margin: 1,
      width: 220,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0d0c", light: "#ffffff" },
    });

    return ok({
      label: result.parcel,
      token: result.token,
      scanUrl,
      qrSvg: svg,
    });
  } catch (error) {
    return handleError(error);
  }
}
