"use client";

import { ImageField } from "@/components/admin/image-field";
import { toBn } from "@/lib/format";
import { Star, X } from "lucide-react";

/* ==========================================================================
   <PhotoGalleryField /> — product photos straight from the device
   --------------------------------------------------------------------------
   Up to `max` pictures. Each tile is an <ImageField>: tapping it opens the
   phone's gallery / camera / file chooser, desktop gets drag-and-drop, the
   file is compressed in the browser and uploaded to /api/upload (bucket
   product-images, approved sellers only). Only the returned public URL is
   kept in the form.

   The first picture is the cover: it is what the product cards show and what
   lands in `products.image`; the whole list goes to `products.images` for the
   product page gallery. "কভার করুন" moves a picture to the front.
   ========================================================================== */

export function PhotoGalleryField({
  value,
  onChange,
  max = 5,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const slots = Math.min(max, value.length + 1);

  function setAt(index: number, url: string) {
    const next = [...value];
    if (url) next[index] = url;
    else next.splice(index, 1);
    onChange(next.filter(Boolean));
  }

  function makeCover(index: number) {
    if (index === 0) return;
    const next = [...value];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  return (
    <div className="sm:col-span-2">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: slots }).map((_, index) => {
          const url = value[index] ?? "";
          return (
            <div key={index} className="min-w-0">
              <ImageField
                value={url}
                onChange={(next) => setAt(index, next)}
                label={index === 0 ? "কভার ছবি" : `ছবি ${toBn(index + 1)}`}
                bucket="product-images"
                endpoint="/api/upload"
                allowUrl={false}
                ratio="square"
              />
              {url && index > 0 ? (
                <button
                  type="button"
                  onClick={() => makeCover(index)}
                  className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-white/[0.04] px-1 py-1 text-[10px] text-sand-100/55 hover:bg-white/[0.08] hover:text-leaf-200"
                >
                  <Star className="h-3 w-3" /> কভার করুন
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10.5px] text-sand-100/40">
          ফোনের গ্যালারি / ক্যামেরা বা কম্পিউটার থেকে বাছুন · প্রথম ছবিটিই কভার · সর্বোচ্চ {toBn(max)}টি
        </p>
        {value.length ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex shrink-0 items-center gap-1 text-[10.5px] text-red-300/80 hover:text-red-300"
          >
            <X className="h-3 w-3" /> সব সরান
          </button>
        ) : null}
      </div>
    </div>
  );
}
