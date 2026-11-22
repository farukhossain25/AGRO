import Image from "next/image";
import { Image as ImageIcon, Upload } from "lucide-react";
import { listMedia } from "@/lib/cms";
import { dbUsable } from "@/lib/db";
import { formatDateBn } from "@/lib/format";
import { MediaUploader } from "@/components/admin/media-uploader";

export const dynamic = "force-dynamic";

export const metadata = { title: "মিডিয়া লাইব্রেরি", robots: { index: false, follow: false } };

/* Section E: one place to see every image uploaded from the admin panel.
   The bytes stay in the existing Storage buckets; `media_assets` (0007) is the
   index. Product/blog/banner forms still take a URL — the library exists so a
   teammate can find that URL without asking a developer. */
export default async function AdminMediaPage() {
  const assets = await listMedia(120);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">মিডিয়া লাইব্রেরি</h1>
          <p className="text-[12px] text-sand-100/45">
            {assets.length ? `${assets.length}টি ছবি — সর্বশেষ প্রথমে` : "এখনো কোনো ছবি আপলোড হয়নি"}
          </p>
        </div>
        <MediaUploader />
      </div>

      {!dbUsable() && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেসে সংযোগ নেই — লাইব্রেরি লোড হয়নি। আপলোড এখনো কাজ করবে, তালিকা পরে দেখা যাবে।
        </p>
      )}

      {assets.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <ImageIcon className="h-8 w-8 text-sand-100/25" />
          <p className="text-[13px] text-sand-100/55">প্রথম ছবিটি আপলোড করুন</p>
          <p className="max-w-sm text-[11.5px] text-sand-100/35">
            JPG, PNG বা WebP — সর্বোচ্চ ৪ MB। আপলোড হলে URL কপি করে পণ্য, ব্লগ বা ব্যানার ফর্মে ব্যবহার
            করতে পারবেন।
          </p>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-sand-100/30">
            <Upload className="h-3 w-3" /> উপরের বাটন থেকে
          </span>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((asset) => (
            <li key={asset.id} className="card overflow-hidden">
              <div className="relative aspect-square bg-white/[0.03]">
                <Image
                  src={asset.url}
                  alt={asset.alt_bn ?? ""}
                  fill
                  sizes="(max-width: 640px) 50vw, 220px"
                  className="object-cover"
                  unoptimized={!asset.url.startsWith("/")}
                />
              </div>
              <div className="space-y-1 p-2.5">
                <p className="truncate text-[11.5px] font-medium text-sand-50">
                  {asset.title_bn ?? asset.path.split("/").pop()}
                </p>
                <p className="text-[10px] text-sand-100/35">
                  {asset.bucket} · {formatDateBn(asset.created_at)}
                </p>
                <code className="block truncate rounded bg-black/30 px-1.5 py-1 text-[9.5px] text-sand-100/50">
                  {asset.url}
                </code>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
