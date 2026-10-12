"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface CategoryItem {
  name: string;
  slug: string;
  icon: React.ReactNode;
}

const CategoriesClient = ({ categories }: { categories: CategoryItem[] }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedCategory = searchParams.get("category");

  const handleChange = (value: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set("category", value || "all");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 bg-slate-100/80 dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-2 rounded-2xl mb-6 text-xs sm:text-sm no-scrollbar whitespace-nowrap shadow-xs dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      {categories.map((category) => (
        <button
          type="button"
          className={`flex items-center justify-center gap-2 cursor-pointer px-3.5 py-2 rounded-xl shrink-0 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none ${
            category.slug === selectedCategory
              ? "bg-white dark:bg-slate-800/90 shadow-sm border border-slate-200/80 dark:border-slate-700/80 font-bold text-indigo-600 dark:text-indigo-400"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/40"
          }`}
          key={category.slug}
          onClick={() => handleChange(category.slug)}
        >
          {category.icon}
          <span>{category.name}</span>
        </button>
      ))}
    </div>
  );
};

export default CategoriesClient;
