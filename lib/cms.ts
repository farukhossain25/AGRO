import { db, dbUsable } from "./db";
import { policies, type Policy } from "./policies";

/* ==========================================================================
   CMS (section E) — pages, FAQ, media
   --------------------------------------------------------------------------
   Content lives in Postgres so a non-developer can edit it from the admin panel. Every
   reader here degrades to the copy that used to be hard-coded in the page, so:

     • a fresh database without the 0007 seed still renders
     • Supabase being down never blanks /faq or /policies/privacy
     • a half-filled CMS row (e.g. title saved, body empty) falls back per field

   Blocks are JSONB. The renderer (components/cms/blocks.tsx) only understands
   the five types below and drops anything else — content is user input, so it
   is never handed to dangerouslySetInnerHTML.
   ========================================================================== */

export type CmsBlock =
  | { type: "heading"; text: string }
  | { type: "text"; body: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; tone?: "info" | "warn"; body: string }
  | { type: "image"; src: string; alt?: string; caption?: string };

export type CmsPage = {
  slug: string;
  title_bn: string;
  title_en: string | null;
  blocks: CmsBlock[];
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
  show_in_footer: boolean;
  updated_at: string;
};

export type FaqItem = {
  id: string;
  group_bn: string;
  question_bn: string;
  answer_bn: string;
  sort_order: number;
};

/** Validate one stored block. Unknown/malformed blocks are dropped, not thrown. */
function parseBlock(raw: unknown): CmsBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  switch (b.type) {
    case "heading":
      return typeof b.text === "string" ? { type: "heading", text: b.text } : null;
    case "text":
      return typeof b.body === "string" ? { type: "text", body: b.body } : null;
    case "list":
      return Array.isArray(b.items)
        ? { type: "list", items: b.items.filter((i): i is string => typeof i === "string") }
        : null;
    case "callout":
      return typeof b.body === "string"
        ? { type: "callout", body: b.body, tone: b.tone === "warn" ? "warn" : "info" }
        : null;
    case "image":
      return typeof b.src === "string"
        ? { type: "image", src: b.src, alt: typeof b.alt === "string" ? b.alt : undefined, caption: typeof b.caption === "string" ? b.caption : undefined }
        : null;
    default:
      return null;
  }
}

export function parseBlocks(value: unknown): CmsBlock[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseBlock).filter((b): b is CmsBlock => b !== null);
}

/** Turn the legacy policy shape into blocks so both sources render identically. */
export function policyToBlocks(policy: Policy): CmsBlock[] {
  return policy.sections.flatMap((section) => [
    { type: "heading", text: section.heading } as CmsBlock,
    ...section.body.map((body) => ({ type: "text", body }) as CmsBlock),
  ]);
}

/* ---------------------------------------------------------------- pages --- */

const PAGE_CACHE_MS = 60_000;
let pageCache: { at: number; bySlug: Map<string, CmsPage> } | null = null;

async function loadPages(): Promise<Map<string, CmsPage>> {
  if (pageCache && Date.now() - pageCache.at < PAGE_CACHE_MS) return pageCache.bySlug;
  const bySlug = new Map<string, CmsPage>();
  if (dbUsable()) {
    try {
      const { data, error } = await db().from("cms_pages").select("*").eq("is_published", true);
      if (error) throw error;
      for (const row of (data ?? []) as (CmsPage & { blocks: unknown })[]) {
        bySlug.set(row.slug, { ...row, blocks: parseBlocks(row.blocks) });
      }
    } catch (error) {
      console.warn("[cms] falling back to bundled policy copy:", (error as Error).message);
    }
  }
  pageCache = { at: Date.now(), bySlug };
  return bySlug;
}

export function clearCmsCache() {
  pageCache = null;
}

/** A CMS page, or the bundled policy of the same slug (older databases). */
export async function getCmsPage(slug: string): Promise<CmsPage | null> {
  const pages = await loadPages();
  const row = pages.get(slug);
  if (row && row.blocks.length) return row;

  const legacy = policies[slug as keyof typeof policies];
  if (!legacy) return row ?? null;

  return {
    slug: legacy.slug,
    title_bn: row?.title_bn ?? legacy.titleBn,
    title_en: row?.title_en ?? legacy.titleEn,
    blocks: policyToBlocks(legacy),
    seo_title: row?.seo_title ?? null,
    seo_description: row?.seo_description ?? null,
    is_published: true,
    show_in_footer: row?.show_in_footer ?? true,
    updated_at: row?.updated_at ?? new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ FAQ --- */

/** Used by /faq only when the database is unreachable; kept small on purpose. */
const FAQ_FALLBACK_GROUPS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "অর্ডার ও ডেলিভারি",
    items: [
      { q: "ডেলিভারি চার্জ কত?", a: "ঢাকা সিটির ভেতরে ৳৬০, ঢাকার বাইরে ৳১২০–১৭০ (জেলা অনুযায়ী)। ৳১,২০০+ অর্ডারে ঢাকায় ফ্রি ডেলিভারি।" },
      { q: "কত দিনে ডেলিভারি পাব?", a: "ঢাকা সিটিতে সকাল ১০টার আগে অর্ডার করলে একই দিনে। বাইরের জেলায় ২–৩ কর্মদিবস।" },
    ],
  },
  {
    title: "পেমেন্ট",
    items: [
      { q: "কী কী পেমেন্ট পদ্ধতি আছে?", a: "বিকাশ, নগদ, কার্ড/SSLCommerz এবং ক্যাশ অন ডেলিভারি।" },
    ],
  },
];

export type FaqGroup = { title: string; items: { q: string; a: string }[] };

/** FAQ grouped for the accordion, in the admin-defined order. */
export async function getFaqGroups(): Promise<FaqGroup[]> {
  if (dbUsable()) {
    try {
      const { data, error } = await db()
        .from("faq_items")
        .select("id, group_bn, question_bn, answer_bn, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      const rows = (data ?? []) as FaqItem[];
      if (rows.length) {
        const order: string[] = [];
        const grouped = new Map<string, { q: string; a: string }[]>();
        for (const row of rows) {
          if (!grouped.has(row.group_bn)) {
            grouped.set(row.group_bn, []);
            order.push(row.group_bn);
          }
          grouped.get(row.group_bn)!.push({ q: row.question_bn, a: row.answer_bn });
        }
        return order.map((title) => ({ title, items: grouped.get(title)! }));
      }
    } catch (error) {
      console.warn("[cms] FAQ fallback:", (error as Error).message);
    }
  }
  return FAQ_FALLBACK_GROUPS;
}

/* ---------------------------------------------------------------- media --- */

export type MediaAsset = {
  id: string;
  bucket: string;
  path: string;
  url: string;
  mime: string | null;
  bytes: number | null;
  alt_bn: string | null;
  title_bn: string | null;
  tags: string[] | null;
  created_at: string;
};

export async function listMedia(limit = 120): Promise<MediaAsset[]> {
  if (!dbUsable()) return [];
  try {
    const { data, error } = await db()
      .from("media_assets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as MediaAsset[];
  } catch (error) {
    console.warn("[cms] media list failed:", (error as Error).message);
    return [];
  }
}

/** Record an upload so the media library can find it later. Never throws. */
export async function recordMedia(input: {
  bucket: string;
  path: string;
  url: string;
  mime?: string | null;
  bytes?: number | null;
  uploadedBy?: string | null;
  altBn?: string | null;
}) {
  if (!dbUsable()) return;
  try {
    await db()
      .from("media_assets")
      .upsert(
        {
          bucket: input.bucket,
          path: input.path,
          url: input.url,
          mime: input.mime ?? null,
          bytes: input.bytes ?? null,
          uploaded_by: input.uploadedBy ?? null,
          alt_bn: input.altBn ?? null,
        },
        { onConflict: "bucket,path" }
      );
  } catch (error) {
    // A missing media row must never fail an upload that already succeeded.
    console.warn("[cms] media record skipped:", (error as Error).message);
  }
}
