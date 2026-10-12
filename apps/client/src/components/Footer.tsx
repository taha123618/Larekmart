"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "react-toastify";
import { Mail, ArrowRight, Sparkles, Lock } from "lucide-react";

export default function Footer() {
  const [email, setEmail] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    toast.success(
      "Thank you for subscribing! Your $10 coupon code is on its way.",
    );
    setEmail("");
  };

  return (
    <footer className="mt-20 bg-slate-950 text-slate-300 border-t border-slate-800">
      {/* 1. NEWSLETTER & VIP PROMO BAR */}
      <div className="border-b border-slate-800/80 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="max-w-lg text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold mb-2 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>VIP Club Exclusives</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Get $10 Off Your Next Order
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Subscribe for flash deal alerts, secret coupons, and weekly new
              arrival highlights.
            </p>
          </div>

          <form
            onSubmit={handleSubscribe}
            className="flex w-full max-w-md items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-inner"
          >
            <div className="pl-3 text-slate-500">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email..."
              className="flex-1 bg-transparent px-2 py-2 text-xs text-white placeholder-slate-500 outline-hidden"
              required
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-md shadow-indigo-900/30"
            >
              <span>Subscribe</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* 2. DIRECTORY NAVIGATION */}
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand Info */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-indigo-600">
                <Image
                  src="/logo.png"
                  alt="Larekmart"
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              </div>
              <span className="text-lg font-black tracking-tight text-white">
                LAREKMART<span className="text-indigo-500">.</span>
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Global multi-vendor marketplace connecting verified sellers with
              millions of customers worldwide.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>256-Bit SSL Encrypted Checkout</span>
            </div>
          </div>

          {/* Customer Care */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              Customer Service
            </h4>
            <div className="flex flex-col gap-2 text-xs text-slate-400">
              <Link href="/track" className="hover:text-white transition">
                Track Your Order
              </Link>
              <Link href="/orders" className="hover:text-white transition">
                Order History
              </Link>
              <Link href="/return" className="hover:text-white transition">
                Returns & Refunds
              </Link>
              <Link href="/account" className="hover:text-white transition">
                Account Settings
              </Link>
              <Link href="/track" className="hover:text-white transition">
                Shipping Policy
              </Link>
            </div>
          </div>

          {/* Shop Departments */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              Departments
            </h4>
            <div className="flex flex-col gap-2 text-xs text-slate-400">
              <Link
                href="/products?category=mens-clothing"
                className="hover:text-white transition"
              >
                Men&apos;s Apparel
              </Link>
              <Link
                href="/products?category=womens-clothing"
                className="hover:text-white transition"
              >
                Women&apos;s Fashion
              </Link>
              <Link
                href="/products?category=shoes"
                className="hover:text-white transition"
              >
                Footwear & Sneakers
              </Link>
              <Link
                href="/products?category=sports"
                className="hover:text-white transition"
              >
                Activewear & Gear
              </Link>
              <Link
                href="/products?sort=newest"
                className="hover:text-white transition"
              >
                New Arrivals
              </Link>
            </div>
          </div>

          {/* Sell & Partner */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              Sell & Partner
            </h4>
            <div className="flex flex-col gap-2 text-xs text-slate-400">
              <Link href="/" className="hover:text-white transition">
                Sell on Larekmart
              </Link>
              <Link href="/" className="hover:text-white transition">
                Merchant Hub
              </Link>
              <Link href="/" className="hover:text-white transition">
                Affiliate Program
              </Link>
              <Link href="/" className="hover:text-white transition">
                Wholesale / Bulk
              </Link>
              <Link href="/" className="hover:text-white transition">
                Brand Protection
              </Link>
            </div>
          </div>

          {/* About & Trust */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              About Larekmart
            </h4>
            <div className="flex flex-col gap-2 text-xs text-slate-400">
              <Link href="/" className="hover:text-white transition">
                About Our Marketplace
              </Link>
              <Link href="/" className="hover:text-white transition">
                Buyer Protection
              </Link>
              <Link href="/" className="hover:text-white transition">
                Privacy Policy
              </Link>
              <Link href="/" className="hover:text-white transition">
                Terms of Service
              </Link>
              <Link href="/" className="hover:text-white transition">
                Dispute Resolution
              </Link>
            </div>
          </div>
        </div>

        {/* 3. PAYMENT METHODS & TRUST RIBBON */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 text-xs text-slate-400">
            <span>Guaranteed Safe Checkout:</span>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="px-2 py-1 bg-slate-900 rounded-md border border-slate-800 font-mono text-[10px] text-white">
                STRIPE
              </span>
              <span className="px-2 py-1 bg-slate-900 rounded-md border border-slate-800 font-mono text-[10px] text-white">
                VISA
              </span>
              <span className="px-2 py-1 bg-slate-900 rounded-md border border-slate-800 font-mono text-[10px] text-white">
                MASTERCARD
              </span>
              <span className="px-2 py-1 bg-slate-900 rounded-md border border-slate-800 font-mono text-[10px] text-white">
                APPLE PAY
              </span>
              <span className="px-2 py-1 bg-slate-900 rounded-md border border-slate-800 font-mono text-[10px] text-white">
                COD
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Larekmart Marketplace Inc. All
            rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
