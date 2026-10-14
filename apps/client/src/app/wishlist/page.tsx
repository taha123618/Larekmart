"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useWishlistStore } from "@/stores/wishlistStore";
import useCartStore from "@/stores/cartStore";
import {
  Heart,
  Plus,
  Share2,
  Trash2,
  ShoppingCart,
  TrendingDown,
  AlertTriangle,
  Folder,
  Check,
  ExternalLink,
  ArrowRight,
  Package,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import MediaImage from "@/components/MediaImage";

export default function WishlistPage() {
  const { isSignedIn, getToken } = useAuth();
  const {
    items,
    wishlists,
    activeWishlistId,
    activeWishlistName,
    isLoading,
    isSyncing,
    syncWithBackend,
    selectWishlist,
    createNewWishlist,
    shareActiveWishlist,
    removeFromWishlist,
    clearWishlist,
  } = useWishlistStore();

  const { addToCart } = useCartStore();

  const [newListName, setNewListName] = useState("");
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      getToken().then((token) => {
        if (token) syncWithBackend(token);
      });
    }
  }, [isSignedIn, getToken, syncWithBackend]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const token = await getToken();
    const createdId = await createNewWishlist(
      newListName.trim(),
      token || undefined,
    );
    if (createdId) {
      toast.success(`Created wishlist "${newListName.trim()}"`);
      setNewListName("");
      setIsCreatingList(false);
    } else {
      toast.error("Failed to create wishlist");
    }
  };

  const handleShareList = async () => {
    if (!isSignedIn) {
      toast.info("Please sign in to share your wishlist!");
      return;
    }

    try {
      setIsSharing(true);
      const token = await getToken();
      if (!token) return;

      const url = await shareActiveWishlist(token);
      if (url) {
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        toast.success("Share link copied to clipboard!");
        setTimeout(() => setCopiedLink(false), 3000);
      }
    } catch {
      toast.error("Could not share wishlist");
    } finally {
      setIsSharing(false);
    }
  };

  const handleMoveToCart = (item: (typeof items)[0]) => {
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      selectedSize: "m",
      selectedColor: "default",
      shortDescription: "",
      description: "",
      categorySlug: item.categorySlug,
      sizes: ["m"],
      colors: ["default"],
      images: { default: item.image },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    removeFromWishlist(item.id);
    toast.success(`${item.name} moved to cart!`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900/80 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500 shadow-sm">
              <Heart className="w-7 h-7 fill-rose-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                My Wishlists
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Organize saved items, track price drops, and share gift lists
                with friends
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsCreatingList(!isCreatingList)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Wishlist</span>
            </button>

            {items.length > 0 && (
              <button
                onClick={handleShareList}
                disabled={isSharing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Share List</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Create New List Modal / Inline Bar */}
        {isCreatingList && (
          <form
            onSubmit={handleCreateList}
            className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 shadow-lg shadow-indigo-500/5 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <Folder className="w-5 h-5 text-indigo-500 shrink-0" />
            <input
              type="text"
              placeholder="e.g. Holiday Gift Ideas, Birthday Wishlist, Home Decor"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingList(false)}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Multi-Wishlist Tab Navigation */}
        {wishlists.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {wishlists.map((list) => {
              const isActive = list.id === activeWishlistId;
              return (
                <button
                  key={list.id}
                  onClick={() => {
                    getToken().then((t) =>
                      selectWishlist(list.id, t || undefined),
                    );
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>{list.name}</span>
                  {list.isDefault && (
                    <span className="text-[10px] uppercase font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400">
                      Default
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Wishlist Items Grid */}
        {isLoading || isSyncing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-72 rounded-3xl bg-slate-200/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/80 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-400 mb-4">
              <Heart className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {activeWishlistName} is currently empty
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-8">
              Explore our marketplace products and save your favorite items by
              clicking the heart button.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-600/25 transition"
            >
              <Package className="w-4 h-4" />
              <span>Browse Catalog</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const hasPriceDrop =
                item.currentPriceInPaisa &&
                item.addedPriceInPaisa &&
                item.currentPriceInPaisa < item.addedPriceInPaisa;

              return (
                <div
                  key={item.id}
                  className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
                >
                  {/* Image Header */}
                  <div className="relative aspect-4/3 bg-slate-100 dark:bg-slate-950/60 overflow-hidden flex items-center justify-center">
                    <Link
                      href={`/products/${item.id}`}
                      className="w-full h-full flex items-center justify-center p-6"
                    >
                      {item.image ? (
                        <MediaImage
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-xs text-slate-400">
                          No Image Preview
                        </div>
                      )}
                    </Link>

                    {/* Status Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      {hasPriceDrop && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow-md">
                          <TrendingDown className="w-3.5 h-3.5" />
                          Price Drop!
                        </span>
                      )}

                      {item.inStock === false && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500 text-white shadow-md">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Out of Stock
                        </span>
                      )}
                    </div>

                    {/* Quick Remove Button */}
                    <button
                      onClick={() => removeFromWishlist(item.id)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-rose-600 shadow-sm hover:shadow-md transition cursor-pointer"
                      title="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <Link
                        href={`/products/${item.id}`}
                        className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Saved on {new Date(item.addedAt).toLocaleDateString()}
                      </p>

                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                          ${item.price.toFixed(2)}
                        </span>
                        {item.addedPriceInPaisa && hasPriceDrop && (
                          <span className="text-xs text-slate-400 line-through">
                            ${(item.addedPriceInPaisa / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => handleMoveToCart(item)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Move to Cart</span>
                      </button>

                      <Link
                        href={`/products/${item.id}`}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                        title="View Product"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Footer Actions */}
        {items.length > 0 && (
          <div className="flex items-center justify-between pt-6 border-t border-slate-200/80 dark:border-slate-800">
            <button
              onClick={() => clearWishlist()}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer"
            >
              Clear Entire Wishlist
            </button>

            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition"
            >
              <span>Continue Shopping</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
