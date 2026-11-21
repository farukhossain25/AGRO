import { db, isDbConfigured } from "@/lib/db";
import { getCategories, getProducts } from "@/lib/data";
import { ProductManager } from "@/components/admin/product-manager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [categories, products] = await Promise.all([getCategories(false), getProducts({})]);

  let initial = products;

  // Admin needs inactive products too — read directly when the DB is available.
  if (isDbConfigured()) {
    try {
      const { data } = await db().from("products").select("*").order("created_at", { ascending: false });
      if (data?.length) initial = data;
    } catch {
      /* fall back to active catalogue */
    }
  }

  return (
    <ProductManager
      initial={initial}
      categories={categories.map((c) => ({ id: c.id, name_bn: c.name_bn }))}
      dbReady={isDbConfigured()}
    />
  );
}
