import { getHomeLayout } from "@/lib/content";
import { LayoutManager } from "@/components/admin/layout-manager";

export const dynamic = "force-dynamic";

/** /foisal/homepage — drag-to-reorder the storefront. */
export default async function AdminHomepagePage() {
  const sections = await getHomeLayout();
  return <LayoutManager initial={sections} />;
}
