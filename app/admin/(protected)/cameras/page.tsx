import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";
import { allSeedCameras, seedFarms } from "@/lib/seed-premium";

export const dynamic = "force-dynamic";

export default async function AdminCamerasPage() {
  const farmLabel = (id: unknown) => seedFarms.find((f) => f.id === id)?.name_bn ?? "—";

  let rows: Record<string, unknown>[] = allSeedCameras.map((c) => ({
    ...c,
    farm_name: farmLabel(c.farm_id),
  })) as unknown as Record<string, unknown>[];
  let farmOptions: { value: string; label: string }[] = seedFarms.map((f) => ({
    value: f.id,
    label: f.name_bn,
  }));
  let online = rows.filter((r) => r.status === "online").length;
  let dbReady = isDbConfigured();
  const proxyReady = Boolean(process.env.STREAM_PROXY_TARGET);

  if (isDbConfigured()) {
    try {
      const [{ data: cams }, { data: farms }] = await Promise.all([
        db().from("cameras").select("*").order("farm_id").order("sort_order"),
        db().from("farms").select("id, name_bn").order("name_bn"),
      ]);

      if (farms?.length) {
        farmOptions = farms.map((f) => ({ value: f.id, label: f.name_bn }));
      }
      if (cams?.length) {
        rows = (cams as Record<string, unknown>[]).map((c) => ({
          ...c,
          farm_name: farmOptions.find((f) => f.value === c.farm_id)?.label ?? "—",
        }));
        online = rows.filter((r) => r.status === "online").length;
      }
    } catch {
      dbReady = false;
    }
  }

  return (
    <div className="space-y-4">
      {!proxyReady && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3.5 text-[11.5px] leading-relaxed text-amber-200">
          <strong>STREAM_PROXY_TARGET সেট করা নেই।</strong> ক্যামেরা রেকর্ড রাখা যাবে, কিন্তু লাইভ স্ট্রিম চলবে
          না। MediaMTX চালু করে <code className="rounded bg-black/30 px-1">STREAM_PROXY_TARGET</code> এনভায়রনমেন্ট
          ভেরিয়েবলে URL দিন (যেমন <code className="rounded bg-black/30 px-1">http://mediamtx:8888</code>)।
        </div>
      )}

      <SimpleManager
        title="ক্যামেরা"
        subtitle={`${rows.length}টি ক্যামেরা · ${online}টি অনলাইন`}
        resource="cameras"
        initial={rows}
        dbReady={dbReady}
        emptyRow={{
          farm_id: farmOptions[0]?.value ?? "",
          name_bn: "",
          zone_bn: "জমি",
          stream_key: "",
          protocol: "hls",
          status: "offline",
          max_viewers: 50,
          is_active: true,
          is_premium: true,
          sort_order: 99,
        }}
        columns={[
          { key: "name_bn", label: "ক্যামেরা", format: "stack", subKey: "zone_bn" },
          { key: "farm_name", label: "খামার" },
          { key: "stream_key", label: "Stream key", format: "code" },
          { key: "protocol", label: "প্রোটোকল" },
          { key: "status", label: "স্টেটাস" },
          { key: "max_viewers", label: "দর্শক", format: "number" },
          { key: "is_active", label: "সক্রিয়", format: "badge", trueLabel: "হ্যাঁ", falseLabel: "না" },
        ]}
        fields={[
          { name: "farm_id", label: "খামার", type: "select", options: farmOptions, required: true, colSpan: 2 },
          { name: "name_bn", label: "ক্যামেরার নাম", type: "text", required: true, colSpan: 2 },
          {
            name: "zone_bn",
            label: "জোন",
            type: "select",
            options: ["জমি", "গোয়ালঘর", "মুরগিঘর", "পুকুর", "প্যাকিং", "গুদাম"].map((z) => ({
              value: z,
              label: z,
            })),
          },
          {
            name: "protocol",
            label: "প্রোটোকল",
            type: "select",
            options: [
              { value: "hls", label: "HLS (MediaMTX)" },
              { value: "webrtc", label: "WebRTC (go2rtc)" },
            ],
          },
          {
            name: "stream_key",
            label: "Stream key",
            type: "text",
            required: true,
            colSpan: 2,
            hint: "MediaMTX path নাম — কখনো ব্রাউজারে যায় না",
          },
          {
            name: "status",
            label: "স্টেটাস",
            type: "select",
            options: [
              { value: "online", label: "অনলাইন" },
              { value: "offline", label: "অফলাইন" },
              { value: "maintenance", label: "রক্ষণাবেক্ষণ" },
            ],
          },
          { name: "max_viewers", label: "সর্বোচ্চ দর্শক", type: "number" },
          { name: "sort_order", label: "ক্রম", type: "number" },
          { name: "is_active", label: "সক্রিয়", type: "checkbox" },
          { name: "is_premium", label: "প্রিমিয়াম", type: "checkbox" },
        ]}
      />
    </div>
  );
}
