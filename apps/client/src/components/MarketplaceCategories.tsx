import type React from "react";
import Link from "next/link";
import {
  Shirt,
  Footprints,
  Watch,
  Laptop,
  Dumbbell,
  ShoppingBag,
  Tag,
  Briefcase,
  Venus,
  Home,
  Sparkles,
  LucideIcon,
} from "lucide-react";
import {
  fetchCatalogCategories,
  type CatalogCategory,
} from "@/services/catalog.service";

interface CategoryVisual {
  icon: LucideIcon;
  bgLight: string;
}

const CATEGORY_STYLES: Record<string, CategoryVisual> = {
  "mens-clothing": {
    icon: Shirt,
    bgLight:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50",
  },
  men: {
    icon: Shirt,
    bgLight:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50",
  },
  "t-shirts": {
    icon: Shirt,
    bgLight:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50",
  },
  "womens-clothing": {
    icon: ShoppingBag,
    bgLight:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50",
  },
  women: {
    icon: ShoppingBag,
    bgLight:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50",
  },
  dresses: {
    icon: Venus,
    bgLight:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50",
  },
  shoes: {
    icon: Footprints,
    bgLight:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50",
  },
  footwear: {
    icon: Footprints,
    bgLight:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50",
  },
  electronics: {
    icon: Laptop,
    bgLight:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50",
  },
  sports: {
    icon: Dumbbell,
    bgLight:
      "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/50",
  },
  accessories: {
    icon: Watch,
    bgLight:
      "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/50",
  },
  bags: {
    icon: Briefcase,
    bgLight:
      "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/50",
  },
  home: {
    icon: Home,
    bgLight:
      "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-900/50",
  },
  beauty: {
    icon: Sparkles,
    bgLight:
      "bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border-pink-100 dark:border-pink-900/50",
  },
};

const DEFAULT_STYLE: CategoryVisual = {
  icon: Tag,
  bgLight:
    "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
};

function getCategoryVisual(slug: string): CategoryVisual {
  const normalized = slug.toLowerCase();
  for (const [key, visual] of Object.entries(CATEGORY_STYLES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return visual;
    }
  }
  return DEFAULT_STYLE;
}

const FALLBACK_CATEGORIES: CatalogCategory[] = [
  {
    id: "fb-1",
    name: "Men's Apparel",
    slug: "mens-clothing",
    isActive: true,
    productCount: 28,
    position: 1,
    children: [],
  },
  {
    id: "fb-2",
    name: "Women's Fashion",
    slug: "womens-clothing",
    isActive: true,
    productCount: 42,
    position: 2,
    children: [],
  },
  {
    id: "fb-3",
    name: "Footwear & Shoes",
    slug: "shoes",
    isActive: true,
    productCount: 31,
    position: 3,
    children: [],
  },
  {
    id: "fb-4",
    name: "Electronics & Tech",
    slug: "electronics",
    isActive: true,
    productCount: 54,
    position: 4,
    children: [],
  },
  {
    id: "fb-5",
    name: "Sports & Fitness",
    slug: "sports",
    isActive: true,
    productCount: 19,
    position: 5,
    children: [],
  },
  {
    id: "fb-6",
    name: "Bags & Accessories",
    slug: "accessories",
    isActive: true,
    productCount: 37,
    position: 6,
    children: [],
  },
];

export default async function MarketplaceCategories(): Promise<React.JSX.Element> {
  const serverCategories = await fetchCatalogCategories();

  // Filter top-level categories and sort by product count or position
  let categories: CatalogCategory[] = serverCategories
    .filter((c) => !c.parentId && c.isActive)
    .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
    .slice(0, 6);

  if (categories.length === 0) {
    categories = FALLBACK_CATEGORIES;
  }

  return (
    <section className="my-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Popular Categories
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse live marketplace departments directly from our catalog
          </p>
        </div>
        <Link
          href="/products"
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition flex items-center gap-1"
        >
          <span>All Departments</span>
          <span>&rarr;</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {categories.map((cat) => {
          const visual = getCategoryVisual(cat.slug);
          const Icon = visual.icon;

          return (
            <Link
              key={cat.id || cat.slug}
              href={`/products?category=${cat.slug}`}
              className="group p-4 bg-white dark:bg-slate-900/70 dark:backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-slate-800/80 hover:border-indigo-400 dark:hover:border-indigo-500/60 hover:shadow-lg dark:hover:shadow-[0_10px_25px_-5px_rgba(99,102,241,0.15)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-300 flex flex-col items-center text-center hover:-translate-y-1"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 shadow-xs ${visual.bgLight} border`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-1">
                {cat.name}
              </h3>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                {cat.productCount > 0
                  ? `${cat.productCount} ${cat.productCount === 1 ? "item" : "items"}`
                  : "Explore items"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
