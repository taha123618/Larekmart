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
    <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 bg-slate-100 p-2 rounded-xl mb-4 text-xs sm:text-sm no-scrollbar whitespace-nowrap">
      {categories.map((category) => (
        <div
          className={`flex items-center justify-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg shrink-0 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
            category.slug === selectedCategory
              ? "bg-white shadow-xs font-bold text-indigo-600"
              : "text-slate-600 hover:text-slate-900 bg-white/50 sm:bg-transparent"
          }`}
          key={category.slug}
          onClick={() => handleChange(category.slug)}
        >
          {category.icon}
          <span>{category.name}</span>
        </div>
      ))}
    </div>
  );
};

export default CategoriesClient;
