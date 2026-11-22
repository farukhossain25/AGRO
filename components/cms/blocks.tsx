import Image from "next/image";
import type { CmsBlock } from "@/lib/cms";

/* Renders CMS blocks. Content is editor-supplied, so every value is placed as
   text or a validated URL — never as raw HTML. Anything the parser did not
   recognise has already been dropped by lib/cms.ts before it gets here. */

function isSafeSrc(src: string): boolean {
  return src.startsWith("/") || src.startsWith("https://");
}

export function CmsBlocks({ blocks }: { blocks: CmsBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <h2
                key={index}
                className="scroll-mt-24 pt-4 text-[19px] font-bold leading-snug text-sand-50 first:pt-0"
              >
                {block.text}
              </h2>
            );

          case "text":
            return (
              <p key={index} className="text-[14.5px] leading-[1.85] text-sand-100/75">
                {block.body}
              </p>
            );

          case "list":
            return (
              <ul key={index} className="space-y-2 pl-1">
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-[14.5px] leading-[1.8] text-sand-100/75">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-400/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );

          case "callout":
            return (
              <div
                key={index}
                className={`rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed ${
                  block.tone === "warn"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-100/90"
                    : "border-leaf-500/25 bg-leaf-500/10 text-leaf-100/90"
                }`}
              >
                {block.body}
              </div>
            );

          case "image":
            if (!isSafeSrc(block.src)) return null;
            return (
              <figure key={index} className="space-y-2">
                <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-white/10">
                  <Image
                    src={block.src}
                    alt={block.alt ?? ""}
                    fill
                    sizes="(max-width: 768px) 100vw, 720px"
                    className="object-cover"
                  />
                </div>
                {block.caption ? (
                  <figcaption className="text-center text-[12px] text-sand-100/45">{block.caption}</figcaption>
                ) : null}
              </figure>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
