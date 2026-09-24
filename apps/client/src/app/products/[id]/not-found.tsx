import Link from "next/link";
import { PackageX, ArrowLeft } from "lucide-react";

export default function ProductNotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 mb-6">
        <PackageX className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl mb-2">
        Product Not Found
      </h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 text-sm">
        The product you are looking for doesn&apos;t exist, may have been
        removed, or the link is invalid.
      </p>
      <Link
        href="/products"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Browse All Products
      </Link>
    </div>
  );
}
