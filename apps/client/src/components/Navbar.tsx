"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import SearchBar from "./SearchBar";
import {
  Truck,
  User,
  MapPin,
  Menu,
  ChevronDown,
  Sparkles,
  Flame,
  Tag,
  ShieldCheck,
  Layers,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import WishlistButton from "./WishlistButton";
import CartHeaderButton from "./CartHeaderButton";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import ProfileButton from "./ProfileButton";

const CATEGORY_LINKS = [
  { label: "Super Deals", href: "/#flash-deals", icon: Flame, highlight: true },
  { label: "All Products", href: "/products", icon: Tag },
  { label: "Trending", href: "/#trending", icon: Sparkles },
  { label: "New Arrivals", href: "/#new-arrivals", icon: Layers },
  { label: "Track Shipment", href: "/track", icon: Truck },
];

export default function Navbar() {
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* 1. TOP UTILITY ANNOUNCEMENT BAR */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Location & Delivery */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-1 text-slate-300 hover:text-white transition cursor-pointer">
              <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>
                Deliver to: <strong className="text-white">Worldwide</strong>
              </span>
            </div>
            <span className="hidden sm:inline text-slate-700">|</span>
            <div className="hidden sm:flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Buyer Protection Guarantee</span>
            </div>
          </div>

          {/* Utility Links */}
          <div className="flex items-center gap-2.5 sm:gap-4 text-[11px] sm:text-xs shrink-0">
            <Link
              href="/track"
              className="hover:text-white transition flex items-center gap-1"
            >
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">Track Orders</span>
            </Link>
            <Link href="/orders" className="hover:text-white transition">
              My Orders
            </Link>
            <span className="hidden sm:inline text-slate-700">|</span>
            <div className="hidden sm:flex items-center gap-1 text-slate-300 cursor-pointer hover:text-white">
              <span>USD $</span>
              <span className="text-slate-500">•</span>
              <span>EN</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER OMNIBAR */}
      <div className="py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* LOGO */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-xs border border-slate-100 group-hover:scale-105 transition">
              <Image
                src="/logo.png"
                alt="Larekmart"
                fill
                sizes="40px"
                className="object-cover"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition">
                LAREKMART<span className="text-indigo-600">.</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 -mt-1 hidden sm:block">
                Marketplace
              </span>
            </div>
          </Link>

          {/* SEARCH BAR (CENTER) */}
          <div className="flex-1 max-w-2xl mx-auto hidden md:block">
            <Suspense
              fallback={
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              }
            >
              <SearchBar />
            </Suspense>
          </div>

          {/* RIGHT ACTION BUTTONS */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Wishlist */}
            <WishlistButton />

            {/* Notifications */}
            <NotificationBell />

            {/* Cart Drawer Trigger */}
            <CartHeaderButton />

            {/* Auth */}
            <div className="pl-1 sm:pl-2 border-l border-slate-200">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer">
                    <User className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center gap-2">
                  <Link
                    href="/account"
                    className="p-2 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-100 transition hidden sm:flex"
                    title="Account Settings"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                  <ProfileButton />
                </div>
              </SignedIn>
            </div>
          </div>
        </div>

        {/* MOBILE SEARCH BAR */}
        <div className="mt-3 md:hidden">
          <Suspense fallback={<div className="h-10 bg-slate-100 rounded-xl" />}>
            <SearchBar />
          </Suspense>
        </div>
      </div>

      {/* 3. CATEGORY NAVIGATION RIBBON */}
      <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 sm:px-6 hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-1">
            {/* All Categories Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="flex items-center gap-2 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-t-lg transition font-bold"
              >
                <Menu className="w-4 h-4" />
                <span>All Categories</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Categories Mega Dropdown */}
              {categoryDropdownOpen && (
                <div className="absolute top-full left-0 w-64 bg-white rounded-b-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  {[
                    { name: "Electronics & Tech", slug: "electronics" },
                    { name: "Men's Fashion", slug: "mens-clothing" },
                    { name: "Women's Fashion", slug: "womens-clothing" },
                    { name: "Shoes & Footwear", slug: "shoes" },
                    { name: "Home & Kitchen", slug: "home-kitchen" },
                    { name: "Sports & Outdoors", slug: "sports" },
                    { name: "Beauty & Health", slug: "beauty" },
                  ].map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/products?category=${cat.slug}`}
                      onClick={() => setCategoryDropdownOpen(false)}
                      className="flex items-center justify-between px-4 py-2.5 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                    >
                      <span>{cat.name}</span>
                      <span className="text-slate-400 text-[10px]">&rarr;</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Ribbon Links */}
            <nav className="flex items-center gap-1 pl-3">
              {CATEGORY_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-1.5 py-2.5 px-3 rounded-lg transition ${
                      item.highlight
                        ? "text-rose-600 hover:bg-rose-50 font-bold"
                        : "hover:text-indigo-600 hover:bg-slate-100/70"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${item.highlight ? "text-rose-600" : "text-slate-500"}`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Ribbon Highlight */}
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <Sparkles
              suppressHydrationWarning
              className="w-3.5 h-3.5 animate-spin"
              style={{ animationDuration: "4s" }}
            />
            <span>Summer Super Sale: Up to 70% Off</span>
          </div>
        </div>
      </div>

      {/* 4. MOBILE CATEGORIES HORIZONTAL SCROLL STRIP (Under 640px) */}
      <div className="sm:hidden bg-slate-50 border-t border-slate-200/80 px-3 py-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold">
          {CATEGORY_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg shrink-0 transition ${
                  item.highlight
                    ? "bg-rose-50 text-rose-600 font-bold border border-rose-200/60"
                    : "bg-white text-slate-700 border border-slate-200/60 hover:bg-slate-50"
                }`}
              >
                <Icon
                  className={`w-3 h-3 ${item.highlight ? "text-rose-600" : "text-slate-500"}`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
