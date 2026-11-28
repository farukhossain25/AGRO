import { db, isDbConfigured } from "@/lib/db";
import { SimpleManager } from "@/components/admin/simple-manager";
import { ChannelLinkTester } from "@/components/admin/channel-link-tester";
import { PROVIDER_LABEL_BN, audienceLabelBn } from "@/lib/camera-source";

/** Same words as the form's select, so a row never disagrees with its editor. */
export const dynamic = "force-dynamic";

export default async function AdminCamerasPage() {
  let rows: Record<string, unknown>[] = [];
  let farmOptions: { value: string; label: string }[] = [];
  let online = rows.filter((r) => r.status === "online").length;
  let dbReady = isDbConfigured();
  const proxyReady = Boolean(process.env.STREAM_PROXY_TARGET);
  const imouReady = Boolean(process.env.IMOU_APP_ID && process.env.IMOU_APP_SECRET);
  const ezvizReady = Boolean(process.env.EZVIZ_APP_KEY && process.env.EZVIZ_APP_SECRET);

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
          /* Raw values like 'imou' mean nothing to the owner; the same Bangla
             words as the form's select, so a row never disagrees with its
             editor. `SimpleManager` renders what it is given. */
          cloud_provider_label: PROVIDER_LABEL_BN[String(c.cloud_provider ?? "none")] ?? String(c.cloud_provider),
          audience_label: audienceLabelBn(
            c.cloud_provider as string | null | undefined,
            c.is_premium as boolean | null | undefined
          ),
        }));
        online = rows.filter((r) => r.status === "online").length;
      }
    } catch {
      dbReady = false;
    }
  }

  return (
    <div className="space-y-4">
      {/* MediaMTX is now optional: a cloud-bridge camera (Imou / EZVIZ / a
          public HLS link) plays without any server of ours, so the warning is
          only shown when NO path is configured at all. */}
      {/* A TV channel needs no key at all — paste an .m3u8 and it plays — so a
          site whose live section is channels must not be told that "no live
          path is configured" and pushed towards a vendor cloud it is not using. */}
      {!proxyReady && !imouReady && !ezvizReady && rows.every((r) => r.cloud_provider !== "tv") && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3.5 text-[11.5px] leading-relaxed text-amber-200">
          <strong>লাইভের কোনো পথ চালু নেই।</strong> সবচেয়ে সহজ: নিচে স্ট্রিম সোর্স{" "}
          <strong>“লাইভ টিভি চ্যানেল”</strong> বেছে নিয়ে চ্যানেলের .m3u8 লিংক বসান — কোনো সার্ভার,
          ভিপিএস বা API কী লাগবে না। অথবা Imou/EZVIZ ব্যবহার করতে চাইলে: Vercel-এ{" "}
          <code className="rounded bg-neu-sunken px-1 text-neu-accent-strong">IMOU_APP_ID</code> /{" "}
          <code className="rounded bg-neu-sunken px-1 text-neu-accent-strong">IMOU_APP_SECRET</code> দিন, তারপর
          ক্যামেরার স্ট্রিম সোর্স <strong>Imou Life</strong> বেছে নিন — কোনো ভিপিএস বা ল্যাপটপ লাগবে না।
          EZVIZ হলে <code className="rounded bg-neu-sunken px-1 text-neu-accent-strong">EZVIZ_APP_KEY</code> /{" "}
          <code className="rounded bg-neu-sunken px-1 text-neu-accent-strong">EZVIZ_APP_SECRET</code>।
        </div>
      )}

      {/* Per-provider reminder — a row saved with a provider whose keys are
          missing would fail only when a viewer opens it, so say it here. */}
      {((!imouReady && rows.some((r) => r.cloud_provider === "imou")) ||
        (!ezvizReady && rows.some((r) => r.cloud_provider === "ezviz"))) && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5 text-[11.5px] leading-relaxed text-[#1b5878]">
          <strong>কিছু ক্যামেরার ক্লাউড কী সেট করা নেই।</strong> Imou/EZVIZ ক্যামেরা চালু করতে Vercel-এ
          সংশ্লিষ্ট <code className="rounded bg-neu-sunken px-1">*_APP_ID / *_APP_SECRET</code> যোগ করুন, নইলে
          দর্শক "ক্যামেরা চালু করা যাচ্ছে না" দেখবেন।
        </div>
      )}
      <ChannelLinkTester />
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
          cloud_provider: "none",
          cloud_serial: "",
          cloud_channel: 0,
          status: "online",
          max_viewers: 50,
          is_active: true,
          is_premium: true,
          sort_order: 99,
        }}
        columns={[
          { key: "name_bn", label: "ক্যামেরা", format: "stack", subKey: "zone_bn" },
          { key: "farm_name", label: "খামার" },
          { key: "cloud_provider_label", label: "স্ট্রিম সোর্স" },
          { key: "stream_key", label: "Stream key", format: "code" },
          { key: "protocol", label: "প্রোটোকল" },
          { key: "status", label: "স্টেটাস" },
          { key: "max_viewers", label: "দর্শক", format: "number" },
          { key: "is_active", label: "সক্রিয়", format: "badge", trueLabel: "হ্যাঁ", falseLabel: "না" },
          /* The stored flag and the truth disagree for a channel: `tv` is free
             whatever `is_premium` says (lib/watch-rights.ts enforces it). A
             row reading "প্রিমিয়াম" next to a channel everyone can watch is
             how an owner comes to believe the free section is broken, so the
             label is derived from the provider first. */
          {
            key: "audience_label",
            label: "কে দেখবে",
          },
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
            name: "cloud_provider",
            label: "স্ট্রিম সোর্স",
            type: "select",
            colSpan: 2,
            options: [
              { value: "tv", label: "লাইভ টিভি চ্যানেল (m3u8 — পাবলিক IP লাগে না)" },
              { value: "imou", label: "Imou Life অ্যাপ (কোনো ল্যাপটপ/ভিপিএস ছাড়া)" },
              { value: "ezviz", label: "EZVIZ অ্যাপ (কোনো ল্যাপটপ/ভিপিএস ছাড়া)" },
              { value: "hls", label: "ক্লাউড HLS লিংক (আগে থেকেই পাবলিক)" },
              { value: "none", label: "MediaMTX / RTSP (ভিপিএস লাগবে)" },
            ],
            hint:
              "লাইভ টিভি: নিচের লিংক ঘরে চ্যানেলের .m3u8 ঠিকানা দিন — সবার জন্য ফ্রি চলবে, সাবস্ক্রিপশন লাগবে না। Imou/EZVIZ বেছে নিলে সেলারের ফোনের অ্যাপই ক্যামেরা অনলাইন রাখে।",
          },
          {
            name: "stream_url",
            label: "স্ট্রিম / চ্যানেল লিংক (https)",
            type: "text",
            colSpan: 2,
            placeholder: "https://example.com/live/channel.m3u8",
            hint:
              "যেকোনো .m3u8 বা .m3u লিংক চলবে — সার্ভার নিজেই দেখে নেয় সেটা স্ট্রিম না চ্যানেল-তালিকা, আর তালিকা হলে তার প্রথম চালু চ্যানেল বেছে নেয় (একাধিক ধাপ হলেও)। প্রতিটি আলাদা চ্যানেলের জন্য আলাদা ক্যামেরা রো বানান। Imou/EZVIZ-এ খালি রাখুন। নিচের “লিংক পরীক্ষা করুন” দিয়ে আগেই যাচাই করে নিন।",
          },
          {
            name: "cloud_serial",
            label: "ডিভাইস সিরিয়াল / Device ID",
            type: "text",
            colSpan: 2,
            hint: "Imou: অ্যাপের ডিভাইস তথ্যের Device ID · EZVIZ: ৯ অক্ষরের সিরিয়াল (যেমন F00497273) · DVR হলে চ্যানেল নম্বরও দিন",
          },
          {
            name: "cloud_channel",
            label: "চ্যানেল নম্বর",
            type: "number",
            hint:
              "গুরুত্বপূর্ণ: Imou/Dahua ক্লাউডে গোনা শুরু হয় ০ থেকে — DVR-এর ১ নম্বর চ্যানেল = ০, ২ নম্বর = ১। EZVIZ-এ শুরু ১ থেকে।",
          },
          {
            name: "protocol",
            label: "প্রোটোকল (পুরোনো RTSP পথ)",
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
            colSpan: 2,
            hint: "শুধু MediaMTX পথে দরকার — কখনো ব্রাউজারে যায় না",
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
          {
            name: "is_premium",
            label: "প্রিমিয়াম (টিক তুললে সবার জন্য খোলা)",
            type: "checkbox",
            hint: "টিক থাকলে দেখতে সাবস্ক্রিপশন বা ট্রায়াল লাগবে। টিক তুলে দিলে যে কেউ, এমনকি লগইন ছাড়াও লাইভ দেখতে পারবে — পাবলিক খামার সেকশনের জন্য এটাই। লাইভ টিভি চ্যানেলের ক্ষেত্রে এই টিক কোনো ভূমিকা রাখে না — চ্যানেল সবসময় সবার জন্য ফ্রি।",
          },
        ]}
      />
    </div>
  );
}
