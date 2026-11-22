"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { ProductCard } from "@/components/product-card";
import { EmptyState, Pagination } from "@/components/ui";
import type { Category, Product } from "@/lib/types";

const PER_PAGE = 12;

const sortOptions = [
  { value: "featured", bn: "জনপ্রিয়", en: "Popular" },
  { value: "price_asc", bn: "দাম: কম → বেশি", en: "Price: low → high" },
  { value: "price_desc", bn: "দাম: বেশি → কম", en: "Price: high → low" },
  { value: "newest", bn: "নতুন আগে", en: "Newest first" },
  { value: "rating", bn: "রেটিং", en: "Top rated" },
] as const;

type Sort = (typeof sortOptions)[number]["value"];

export function ProductBrowser({
  products,
  categories,
  initialCategory = "",
  initialQuery = "",
  showCategoryFilter = true,
}: {
  products: Product[];
  categories: Category[];
  initialCategory?: string;
  initialQuery?: string;
  showCategoryFilter?: boolean;
}) {
  const { t } = useLocale();
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<Sort>("featured");
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
    setPage(1);
  }, [initialQuery]);

  useEffect(() => {
    setCategory(initialCategory);
    setPage(1);
  }, [initialCategory]);

  const priceCeiling = useMemo(
    () => Math.max(100, ...products.map((p) => Math.ceil(p.price / 100) * 100)),
    [products]
  );
  const effectiveMax = maxPrice || priceCeiling;

  const filtered = useMemo(() => {
    let list = products.slice();

    if (category) {
      const catId = categories.find((c) => c.slug === category)?.id;
      list = list.filter((p) => p.category_id === catId);
    }
    if (query.trim()) {
      const term = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name_bn.toLowerCase().includes(term) ||
          p.name_en.toLowerCase().includes(term) ||
          (p.description_bn ?? "").toLowerCase().includes(term)
      );
    }
    if (maxPrice) list = list.filter((p) => p.price <= maxPrice);
    if (inStock) list = list.filter((p) => p.stock > 0);

    switch (sort) {
      case "price_asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
      default:
        list.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    }
    return list;
  }, [products, categories, category, query, maxPrice, inStock, sort]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function reset() {
    setCategory("");
    setQuery("");
    setMaxPrice(0);
    setInStock(false);
    setSort("featured");
    setPage(1);
  }

  const activeFilterCount = [category, query, maxPrice && maxPrice !== priceCeiling ? "price" : "", inStock ? "stock" : ""].filter(Boolean).length;

  const filterPanel = (
    <div className="space-y-5">
      {showCategoryFilter ? (
        <div>
          <p className="label">{t("ক্যাটাগরি", "Category")}</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { setCategory(""); setPage(1); }}
              className={`chip ${!category ? "chip-active" : ""}`}
            >
              {t("সব", "All")}
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => { setCategory(c.slug); setPage(1); }}
                className={`chip ${category === c.slug ? "chip-active" : ""}`}
              >
                <span aria-hidden>{c.icon}</span>
                {t(c.name_bn, c.name_en)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="label">{t("সর্বোচ্চ দাম", "Max price")}</p>
        <input
          type="range"
          min={50}
          max={priceCeiling}
          step={50}
          value={effectiveMax}
          onChange={(e) => { setMaxPrice(Number(e.target.value)); setPage(1); }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-leaf-500"
          aria-label={t("সর্বোচ্চ দাম", "Maximum price")}
        />
        <div className="mt-1.5 flex justify-between text-[11.5px] text-sand-100/50">
          <span>৳৫০</span>
          <span className="font-semibold text-leaf-300">৳{effectiveMax}</span>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => { setInStock(e.target.checked); setPage(1); }}
          className="h-4 w-4 rounded border-white/20 bg-ink-800 accent-leaf-500"
        />
        <span className="text-[12.5px] text-sand-100/70">{t("শুধু স্টকে থাকা", "In stock only")}</span>
      </label>

      <button onClick={reset} className="btn-ghost btn-sm w-full">
        <X className="h-3.5 w-3.5" /> {t("ফিল্টার রিসেট", "Reset filters")}
      </button>
    </div>
  );

  return (
    <div>
      {/* toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <label className="relative min-w-0 flex-1 basis-56">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder={t("পণ্য খুঁজুন…", "Search products…")}
            className="input !rounded-full !py-2.5"
            aria-label={t("পণ্য খুঁজুন", "Search products")}
          />
        </label>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="input !w-auto !rounded-full !py-2.5 text-[12.5px]"
          aria-label={t("সাজান", "Sort by")}
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value} className="bg-ink-800">
              {t(o.bn, o.en)}
            </option>
          ))}
        </select>

        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="btn-ghost btn-sm !rounded-full lg:hidden"
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("ফিল্টার", "Filters")}
          {activeFilterCount ? (
            <span className="grid h-4 w-4 place-items-center rounded-full bg-leaf-500 text-[9px] font-bold text-ink-900">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        <span className="ml-auto hidden text-[12px] text-sand-100/45 sm:block">
          {filtered.length} {t("টি পণ্য", "products")}
        </span>
      </div>

      <div className="flex gap-6">
        {/* desktop sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="card sticky top-24 p-4">{filterPanel}</div>
        </aside>

        {/* mobile filter sheet */}
        {filtersOpen ? (
          <div className="fixed inset-0 z-[85] lg:hidden">
            <button className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} aria-label={t("বন্ধ", "Close")} />
            <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink-900 p-5 animate-[fade-up_.25s_ease]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold">{t("ফিল্টার", "Filters")}</h2>
                <button onClick={() => setFiltersOpen(false)} className="rounded-full p-2 hover:bg-white/10" aria-label={t("বন্ধ", "Close")}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              {filterPanel}
              <button onClick={() => setFiltersOpen(false)} className="btn-primary mt-4 w-full">
                {t("ফলাফল দেখুন", "Show results")} ({filtered.length})
              </button>
            </div>
          </div>
        ) : null}

        {/* grid */}
        <div className="min-w-0 flex-1">
          {visible.length ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 200, behavior: "smooth" });
              }} />
            </>
          ) : (
            <EmptyState
              icon="🔍"
              title={t("কোনো পণ্য পাওয়া যায়নি", "No products found")}
              body={t("ফিল্টার বদলে আবার চেষ্টা করুন অথবা অন্য কিছু খুঁজুন।", "Try changing filters or searching for something else.")}
              action={<button onClick={reset} className="btn-ghost btn-sm">{t("ফিল্টার রিসেট", "Reset filters")}</button>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
