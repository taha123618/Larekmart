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
    bgLight: "bg-blue-50 text-blue-600 border-blue-100",
  },
  men: {
    icon: Shirt,
    bgLight: "bg-blue-50 text-blue-600 border-blue-100",
  },
  "t-shirts": {
    icon: Shirt,
    bgLight: "bg-blue-50 text-blue-600 border-blue-100",
  },
  "womens-clothing": {
    icon: ShoppingBag,
    bgLight: "bg-rose-50 text-rose-600 border-rose-100",
  },
  women: {
    icon: ShoppingBag,
    bgLight: "bg-rose-50 text-rose-600 border-rose-100",
  },
  dresses: {
    icon: Venus,
    bgLight: "bg-rose-50 text-rose-600 border-rose-100",
  },
  shoes: {
    icon: Footprints,
    bgLight: "bg-amber-50 text-amber-600 border-amber-100",
  },
  footwear: {
    icon: Footprints,
    bgLight: "bg-amber-50 text-amber-600 border-amber-100",
  },
  electronics: {
    icon: Laptop,
    bgLight: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
  sports: {
    icon: Dumbbell,
    bgLight: "bg-purple-50 text-purple-600 border-purple-100",
  },
  accessories: {
    icon: Watch,
    bgLight: "bg-cyan-50 text-cyan-600 border-cyan-100",
  },
  bags: {
    icon: Briefcase,
    bgLight: "bg-orange-50 text-orange-600 border-orange-100",
  },
  home: {
    icon: Home,
    bgLight: "bg-teal-50 text-teal-600 border-teal-100",
  },
  beauty: {
    icon: Sparkles,
    bgLight: "bg-pink-50 text-pink-600 border-pink-100",
  },
};

const DEFAULT_STYLE: CategoryVisual = {
  icon: Tag,
  bgLight: "bg-slate-50 text-slate-700 border-slate-200",
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

export default async function MarketplaceCategories(): Promise<React.JSX.Element | null> {
  const serverCategories = await fetchCatalogCategories();

  // Filter top-level categories and sort by product count or position
  const categories: CatalogCategory[] = serverCategories
    .filter((c) => !c.parentId && c.isActive)
    .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
    .slice(0, 6);

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="my-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Popular Categories
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse live marketplace departments directly from our catalog
          </p>
        </div>
        <Link
          href="/products"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
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
              className="group p-4 bg-white rounded-2xl border border-slate-200/70 hover:border-indigo-400 hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center hover:-translate-y-1"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 shadow-xs ${visual.bgLight} border`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition line-clamp-1">
                {cat.name}
              </h3>
              <span className="text-[10px] text-slate-400 mt-0.5">
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
