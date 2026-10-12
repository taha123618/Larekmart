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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 bg-gray-100 p-2 rounded-lg mb-4 text-sm">
      {categories.map((category) => (
        <div
          className={`flex items-center justify-center gap-2 cursor-pointer px-2 py-1 rounded-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
            category.slug === selectedCategory
              ? "bg-white shadow-xs font-bold text-indigo-600"
              : "text-gray-500 hover:text-gray-900"
          }`}
          key={category.slug}
          onClick={() => handleChange(category.slug)}
        >
          {category.icon}
          {category.name}
        </div>
      ))}
    </div>
  );
};

export default CategoriesClient;
