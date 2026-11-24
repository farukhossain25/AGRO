import Image from "next/image";
import { MapPin } from "lucide-react";
import type { Farmer } from "@/lib/types";

/* ==========================================================================
   <FarmerCard /> — one farm on "আমাদের খামার" (/farm)
   --------------------------------------------------------------------------
   Picture: the owner-seller's banner (they upload it from the seller
   dashboard), else the farm's cover. Their logo sits on the corner of the
   picture. A seller's farm carries one generated line, so the description is
   shown once — as the story — and "বিশেষত্ব" only when it is a different text.
   ========================================================================== */

export function FarmerCard({ f }: { f: Farmer }) {
  const story = f.story_bn || f.specialty_bn;

  return (
    <article className="card overflow-hidden">
      <div className="grid sm:grid-cols-[160px_1fr]">
        <div className="relative aspect-[4/3] bg-leaf-600/10 sm:aspect-auto sm:self-stretch">
          {f.image ? (
            <Image src={f.image} alt={f.name_bn} fill sizes="200px" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-3xl">🌾</div>
          )}
          {f.image ? <div className="absolute inset-0 bg-gradient-to-r from-transparent to-scrim/60 sm:to-scrim" /> : null}
          {f.logo ? (
            <span className="absolute bottom-2 left-2 h-10 w-10 overflow-hidden rounded-xl bg-white shadow-md ring-2 ring-white/80">
              <Image src={f.logo} alt={`${f.name_bn} লোগো`} fill sizes="40px" className="object-contain p-0.5" />
            </span>
          ) : null}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-bold">{f.name_bn}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-leaf-300">
                <MapPin className="h-3 w-3" /> {f.location_bn}
              </p>
            </div>
            <span className="badge bg-white/[0.06] text-sand-100/60">
              {f.years > 0 ? `${f.years}+ বছর` : "নতুন খামার"}
            </span>
          </div>
          {story && <p className="mt-2 text-[12px] leading-relaxed text-sand-100/55">{story}</p>}
          {f.specialty_bn && f.specialty_bn !== story ? (
            <p className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-leaf-300/70">
              বিশেষত্ব: {f.specialty_bn}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
