import { z } from "zod";
import { db } from "@/lib/db";
import { created, fail, handleError, limitGuard, ok, requireUser } from "@/lib/api";
import { getSellerByUser } from "@/lib/sellers";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

const schema = z.object({
  camera_count: z.coerce.number().int().min(1).max(20).default(1),
  note_bn: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  try {
    const guard = limitGuard(req, "cam-req", 3, 24 * 60 * 60_000);
    if (guard) return guard;

    const user = await requireUser();
    const seller = await getSellerByUser(user.id);
    if (!seller) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);

    const data = schema.parse(await req.json());

    // Don't stack duplicate open requests.
    const { data: open } = await db()
      .from("camera_requests")
      .select("id")
      .eq("seller_id", seller.id)
      .eq("status", "pending")
      .maybeSingle();

    if (open) return fail("আপনার একটি রিকোয়েস্ট আগেই অপেক্ষমাণ আছে", 409);

    const { data: row, error } = await db()
      .from("camera_requests")
      .insert({
        seller_id: seller.id,
        farm_id: seller.farm_id,
        camera_count: data.camera_count,
        note_bn: data.note_bn || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    await notifyAdmins({
      kind: "camera",
      title: "নতুন ক্যামেরা ইনস্টল রিকোয়েস্ট",
      body: `${seller.name_bn} · ${data.camera_count}টি ক্যামেরা`,
      link: "/admin/cameras",
    }).catch(() => undefined);

    return created(row);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const seller = await getSellerByUser(user.id);
    if (!seller) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);

    const { data, error } = await db()
      .from("camera_requests")
      .select("*")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}
