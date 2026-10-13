"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
  Truck,
  RotateCcw,
  Zap,
  ShoppingBag,
} from "lucide-react";

export default function ShopCTA() {
  const [copied, setCopied] = useState(false);
  const couponCode = "LAREK20";

  const handleCopy = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <section className="my-14 sm:my-18 relative">
      {/* Background container with obsidian glassmorphic gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 dark:from-[#0b0f19] dark:via-indigo-950/70 dark:to-[#080c14] border border-indigo-500/30 dark:border-indigo-500/20 shadow-2xl p-8 sm:p-12 lg:p-14 text-white">
        {/* Ambient radial lighting glows */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Limited-Time VIP Shopping Event</span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight sm:leading-tight mb-4">
            Step Into the Marketplace.{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400 bg-clip-text text-transparent">
              Save Up to 70% Today.
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed mb-8">
            Shop over 10,000+ trending lifestyle items, high-performance
            apparel, designer footwear, and cutting-edge electronics with
            verified buyer protection and express worldwide delivery.
          </p>

          {/* Interactive Coupon Box */}
          <div className="mb-8 inline-flex items-center gap-3 p-2 sm:p-2.5 bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl shadow-inner max-w-md w-full justify-between">
            <div className="flex items-center gap-2.5 pl-2 text-left">
              <div className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
                  Instant $20 Voucher
                </div>
                <div className="text-sm font-mono font-black text-amber-300 tracking-wider">
                  {couponCode}
                </div>
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm shrink-0"
              aria-label="Copy coupon code"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-700" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Primary & Secondary Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full justify-center mb-10">
            <Link
              href="/products"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center gap-2 group active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Explore Marketplace Catalog</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/products?sort=popular"
              className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 text-white font-bold rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
            >
              <span>View Best Sellers</span>
            </Link>

            <Link
              href="/products?sort=newest"
              className="w-full sm:w-auto px-6 py-4 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-semibold rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>Fresh Arrivals</span>
            </Link>
          </div>

          {/* Quick Department Navigation Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10 text-xs">
            <span className="text-slate-400 mr-1">Popular right now:</span>
            {[
              { name: "Sneakers & Kicks", href: "/products?category=shoes" },
              {
                name: "Men's Apparel",
                href: "/products?category=mens-clothing",
              },
              {
                name: "Women's Fashion",
                href: "/products?category=womens-clothing",
              },
              {
                name: "Electronics & Tech",
                href: "/products?category=electronics",
              },
              {
                name: "Watches & Jewelry",
                href: "/products?category=accessories",
              },
            ].map((chip) => (
              <Link
                key={chip.name}
                href={chip.href}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 hover:text-white transition-colors"
              >
                {chip.name}
              </Link>
            ))}
          </div>

          {/* Value Props Strip */}
          <div className="w-full pt-8 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">Free Worldwide Ship</div>
                <div className="text-slate-400">On all orders over $50</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">
                  100% Escrow Protection
                </div>
                <div className="text-slate-400">Money back guaranteed</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">30-Day Free Returns</div>
                <div className="text-slate-400">Instant label generation</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">24/7 Live Support</div>
                <div className="text-slate-400">Real human operators</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
