/**
 * Categories.tsx — Server Component
 *
 * Renders the category navigation bar. Fetches live categories from
 * catalog-service (hierarchical read model) instead of using a hardcoded array.
 * Falls back to a curated static set if catalog-service is unavailable.
 */
import {
  Footprints,
  Glasses,
  Briefcase,
  Shirt,
  ShoppingBasket,
  Hand,
  Venus,
  Tag,
} from "lucide-react";
import {
  fetchCatalogCategories,
  type CatalogCategory,
} from "@/services/catalog.service";
import CategoriesClient from "./CategoriesClient";

// ─── Fallback hardcoded categories ──────────────────────────────────────────

const FALLBACK_CATEGORIES = [
  { name: "All", slug: "all" },
  { name: "T-shirts", slug: "t-shirts" },
  { name: "Shoes", slug: "shoes" },
  { name: "Accessories", slug: "accessories" },
  { name: "Bags", slug: "bags" },
  { name: "Dresses", slug: "dresses" },
  { name: "Jackets", slug: "jackets" },
  { name: "Gloves", slug: "gloves" },
];

// ─── Icon mapping ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  all: <ShoppingBasket className="w-4 h-4" />,
  "t-shirts": <Shirt className="w-4 h-4" />,
  shirts: <Shirt className="w-4 h-4" />,
  tops: <Shirt className="w-4 h-4" />,
  shoes: <Footprints className="w-4 h-4" />,
  footwear: <Footprints className="w-4 h-4" />,
  accessories: <Glasses className="w-4 h-4" />,
  bags: <Briefcase className="w-4 h-4" />,
  dresses: <Venus className="w-4 h-4" />,
  jackets: <Shirt className="w-4 h-4" />,
  outerwear: <Shirt className="w-4 h-4" />,
  gloves: <Hand className="w-4 h-4" />,
};

function getIcon(slug: string): React.ReactNode {
  return ICON_MAP[slug.toLowerCase()] ?? <Tag className="w-4 h-4" />;
}

// ─── Data shaping ─────────────────────────────────────────────────────────────

function buildCategoryList(
  serverCategories: CatalogCategory[],
): { name: string; slug: string; icon: React.ReactNode }[] {
  const all = {
    name: "All",
    slug: "all",
    icon: <ShoppingBasket className="w-4 h-4" />,
  };

  if (serverCategories.length === 0) {
    return FALLBACK_CATEGORIES.map((c) => ({ ...c, icon: getIcon(c.slug) }));
  }

  // Show top-level categories only (no parentId) up to 8 items
  const roots = serverCategories
    .filter((c) => !c.parentId && c.isActive)
    .sort((a, b) => a.position - b.position)
    .slice(0, 7);

  return [
    all,
    ...roots.map((c) => ({
      name: c.name,
      slug: c.slug,
      icon: getIcon(c.slug),
    })),
  ];
}

// ─── Server Component ────────────────────────────────────────────────────────

const Categories = async () => {
  const serverCategories = await fetchCatalogCategories();
  const categories = buildCategoryList(serverCategories);

  return <CategoriesClient categories={categories} />;
};

export default Categories;
