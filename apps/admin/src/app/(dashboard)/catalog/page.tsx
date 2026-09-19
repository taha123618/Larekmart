/**
 * Admin Catalog Read-Model Page
 *
 * Shows the live state of the catalog-service CQRS read model:
 * - Categories tree
 * - Active brands
 * - Collections
 * - Featured product count
 * - Service health/readiness
 *
 * Data comes from catalog-service (port 8010) and is read-only —
 * mutations go through product-service.
 */
import {
  fetchCatalogCategories,
  fetchCatalogBrands,
  fetchCatalogCollections,
  fetchFeaturedProducts,
  fetchNewArrivals,
  fetchBestSellers,
  type CatalogCategory,
  type CatalogBrand,
  type CatalogCollection,
  type CatalogProductCard,
} from "@/lib/catalog.service";
import { CheckCircle, AlertCircle, LayoutGrid, Tag, PackageOpen, Star, Flame } from "lucide-react";

// ─── Health check ─────────────────────────────────────────────────────────────

async function getCatalogHealth(): Promise<{ ok: boolean; status?: string }> {
  try {
    const base = process.env.NEXT_PUBLIC_CATALOG_SERVICE_URL || "http://localhost:8010";
    const res = await fetch(`${base}/ready`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json() as { status?: string };
      return { ok: true, status: data.status };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({
  title,
  value,
  icon: Icon,
  color = "blue",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: "blue" | "green" | "amber" | "purple" | "rose";
}) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  };
  return (
    <div className="bg-primary-foreground rounded-xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
};

const CategoryRow = ({ category, depth = 0 }: { category: CatalogCategory; depth?: number }) => (
  <>
    <tr className={`border-b ${!category.isActive ? "opacity-40" : ""}`}>
      <td className="py-2 px-4">
        <span style={{ paddingLeft: `${depth * 16}px` }} className="flex items-center gap-2">
          {depth > 0 && <span className="text-muted-foreground">└</span>}
          {category.name}
        </span>
      </td>
      <td className="py-2 px-4 text-sm text-muted-foreground font-mono">{category.slug}</td>
      <td className="py-2 px-4 text-center">{category.productCount}</td>
      <td className="py-2 px-4">
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${
            category.isActive
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {category.isActive ? "Active" : "Inactive"}
        </span>
      </td>
    </tr>
    {category.children?.map((child) => (
      <CategoryRow key={child.id} category={child} depth={depth + 1} />
    ))}
  </>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const CatalogPage = async () => {
  const [health, categories, brands, collections, featured, newArrivals, bestSellers] =
    await Promise.allSettled([
      getCatalogHealth(),
      fetchCatalogCategories(),
      fetchCatalogBrands(),
      fetchCatalogCollections(),
      fetchFeaturedProducts(100),
      fetchNewArrivals(100),
      fetchBestSellers(100),
    ]);

  const healthData = health.status === "fulfilled" ? health.value : { ok: false };
  const categoriesData: CatalogCategory[] = categories.status === "fulfilled" ? categories.value : [];
  const brandsData: CatalogBrand[] = brands.status === "fulfilled" ? brands.value : [];
  const collectionsData: CatalogCollection[] = collections.status === "fulfilled" ? collections.value : [];
  const featuredData: CatalogProductCard[] = featured.status === "fulfilled" ? featured.value : [];
  const newArrivalsData: CatalogProductCard[] = newArrivals.status === "fulfilled" ? newArrivals.value : [];
  const bestSellersData: CatalogProductCard[] = bestSellers.status === "fulfilled" ? bestSellers.value : [];

  const activeCategoriesCount = categoriesData.filter((c) => c.isActive).length;
  const activeBrandsCount = brandsData.filter((b) => b.isActive).length;
  const activeCollectionsCount = collectionsData.filter((c) => c.status === "active").length;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 py-2 px-4 bg-secondary rounded-md">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5" />
          <h1 className="font-semibold">Catalog Read-Model</h1>
          <span className="text-xs text-muted-foreground ml-2">
            (catalog-service @ port 8010)
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {healthData.ok ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Service Ready</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-600 dark:text-red-400">Service Unavailable</span>
            </>
          )}
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Active Categories" value={activeCategoriesCount} icon={Tag} color="blue" />
        <StatCard title="Active Brands" value={activeBrandsCount} icon={PackageOpen} color="purple" />
        <StatCard title="Active Collections" value={activeCollectionsCount} icon={LayoutGrid} color="green" />
        <StatCard title="Featured Products" value={featuredData.length} icon={Star} color="amber" />
        <StatCard title="New Arrivals" value={newArrivalsData.length} icon={Flame} color="rose" />
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* CATEGORIES */}
        <div className="bg-primary-foreground rounded-xl p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Categories ({categoriesData.length})
          </h2>
          {categoriesData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No categories synced yet. Create categories in product-service — they will be projected here via Kafka.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 px-4">Name</th>
                    <th className="text-left py-2 px-4">Slug</th>
                    <th className="text-center py-2 px-4">Products</th>
                    <th className="text-left py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriesData
                    .filter((c) => !c.parentId)
                    .map((c) => (
                      <CategoryRow key={c.id} category={c} />
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* BRANDS */}
        <div className="bg-primary-foreground rounded-xl p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <PackageOpen className="w-4 h-4" />
            Brands ({brandsData.length})
          </h2>
          {brandsData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No brands synced yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 px-4">Name</th>
                    <th className="text-left py-2 px-4">Slug</th>
                    <th className="text-left py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {brandsData.map((brand) => (
                    <tr key={brand.id} className={`border-b ${!brand.isActive ? "opacity-40" : ""}`}>
                      <td className="py-2 px-4 font-medium">{brand.name}</td>
                      <td className="py-2 px-4 font-mono text-muted-foreground">{brand.slug}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            brand.isActive
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {brand.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* COLLECTIONS */}
        <div className="bg-primary-foreground rounded-xl p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            Collections ({collectionsData.length})
          </h2>
          {collectionsData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No collections synced yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 px-4">Name</th>
                    <th className="text-left py-2 px-4">Slug</th>
                    <th className="text-center py-2 px-4">Products</th>
                    <th className="text-left py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionsData.map((col) => (
                    <tr key={col.id} className="border-b">
                      <td className="py-2 px-4 font-medium">{col.name}</td>
                      <td className="py-2 px-4 font-mono text-muted-foreground">{col.slug}</td>
                      <td className="py-2 px-4 text-center">{col.productCount}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            col.status === "active"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : col.status === "draft"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {col.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* BEST SELLERS */}
        <div className="bg-primary-foreground rounded-xl p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Best Sellers Top 10
          </h2>
          {bestSellersData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No best sellers in read model yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 px-4">#</th>
                    <th className="text-left py-2 px-4">Product</th>
                    <th className="text-right py-2 px-4">Price</th>
                    <th className="text-right py-2 px-4">Rating</th>
                    <th className="text-left py-2 px-4">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {bestSellersData.slice(0, 10).map((p, i) => (
                    <tr key={p.id} className="border-b">
                      <td className="py-2 px-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-4 font-medium line-clamp-1 max-w-[180px]">{p.name}</td>
                      <td className="py-2 px-4 text-right">${p.price.toFixed(2)}</td>
                      <td className="py-2 px-4 text-right">
                        ⭐ {p.rating.toFixed(1)} ({p.reviewCount})
                      </td>
                      <td className="py-2 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            p.availabilityStatus === "in_stock"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : p.availabilityStatus === "low_stock"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          }`}
                        >
                          {p.availabilityStatus.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ARCHITECTURE NOTE */}
      <div className="bg-primary-foreground rounded-xl p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">How this read model works</p>
        <p>
          <strong>catalog-service</strong> subscribes to <code className="bg-muted px-1 rounded">product.*</code>,{" "}
          <code className="bg-muted px-1 rounded">category.*</code>, and{" "}
          <code className="bg-muted px-1 rounded">inventory.*</code> Kafka events published by their
          respective upstream services. Each event is processed idempotently by a CQRS projector and
          denormalized into a PostgreSQL read model. Responses are cached in Redis under{" "}
          <code className="bg-muted px-1 rounded">catalog:v1:</code> for 1 hour.{" "}
          <strong>All data here is eventually consistent</strong> — mutations must go through product-service.
        </p>
      </div>
    </div>
  );
};

export default CatalogPage;
