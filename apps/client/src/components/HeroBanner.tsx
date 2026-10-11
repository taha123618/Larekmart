"use client";

import { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Gift,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SlideData {
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  bgGradient: string;
  accentImage: string;
  stats: { label: string; value: string }[];
}

const SLIDES: SlideData[] = [
  {
    badge: "GLOBAL BRAND FESTIVAL",
    badgeColor: "bg-amber-400 text-slate-950",
    title: "Up to 70% Off Trending Styles",
    subtitle: "Explore high-performance apparel, streetwear, and premium lifestyle footwear curated for you.",
    ctaText: "Shop SuperDeals",
    ctaLink: "/products?sort=desc",
    bgGradient: "from-indigo-900 via-indigo-950 to-slate-950",
    accentImage: "/featured.png",
    stats: [
      { label: "Verified Sellers", value: "10,000+" },
      { label: "Money Back", value: "30 Days" },
      { label: "Dispatch", value: "< 24 Hrs" },
    ],
  },
  {
    badge: "FRESH SEASON DROPS",
    badgeColor: "bg-rose-500 text-white",
    title: "New Season Arrivals Are Here",
    subtitle: "Discover the latest urban techwear and breathable athletics engineered for peak performance.",
    ctaText: "Explore New Arrivals",
    ctaLink: "/products?sort=newest",
    bgGradient: "from-purple-900 via-slate-900 to-slate-950",
    accentImage: "/featured.png",
    stats: [
      { label: "New Products", value: "500+ Daily" },
      { label: "Quality Check", value: "100%" },
      { label: "Global Free Ship", value: "Over $50" },
    ],
  },
];

export default function HeroBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const slideContentRef = useRef<HTMLDivElement>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // GSAP animation for slide changes and element entrances
  useGSAP(
    () => {
      if (!slideContentRef.current) return;

      const tl = gsap.timeline();

      tl.fromTo(
        ".hero-badge",
        { opacity: 0, y: -20, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" }
      )
        .fromTo(
          ".hero-title",
          { opacity: 0, y: 25 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
          "-=0.3"
        )
        .fromTo(
          ".hero-subtitle",
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
          "-=0.4"
        )
        .fromTo(
          ".hero-cta",
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.7)" },
          "-=0.3"
        )
        .fromTo(
          ".hero-stat-card",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease: "power2.out" },
          "-=0.2"
        );
    },
    { scope: containerRef, dependencies: [currentSlideIndex] }
  );

  // Auto-advance banner every 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[currentSlideIndex] || SLIDES[0]!;

  return (
    <div ref={containerRef} className="w-full my-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* MAIN ANIMATED BANNER (8 cols on large screens) */}
        <div
          className={`lg:col-span-8 rounded-3xl bg-gradient-to-br ${slide.bgGradient} text-white p-6 sm:p-10 relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[420px] sm:min-h-[460px] border border-slate-800`}
        >
          {/* Subtle Ambient Lighting Overlay */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Background Graphic Asset */}
          <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-25 lg:opacity-40 pointer-events-none mix-blend-screen">
            <Image
              src={slide.accentImage}
              alt="Promotion"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-right"
              priority
            />
          </div>

          {/* Slide Content */}
          <div ref={slideContentRef} className="relative z-10 max-w-xl">
            {/* Promo Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-4 hero-badge shadow-sm" style={{ backgroundColor: currentSlideIndex === 0 ? "#F59E0B" : "#F43F5E", color: "#0F172A" }}>
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{slide.badge}</span>
            </div>

            {/* Title */}
            <h1 className="hero-title text-3xl sm:text-5xl font-black tracking-tight leading-tight sm:leading-none text-white mb-4">
              {slide.title}
            </h1>

            {/* Subtitle */}
            <p className="hero-subtitle text-sm sm:text-base text-slate-300 leading-relaxed mb-8 max-w-lg">
              {slide.subtitle}
            </p>

            {/* Action CTA */}
            <div className="hero-cta flex items-center gap-4">
              <Link
                href={slide.ctaLink}
                className="px-6 py-3.5 bg-white text-slate-950 font-bold rounded-2xl text-sm hover:bg-slate-100 hover:shadow-lg hover:shadow-white/20 transition flex items-center gap-2 group cursor-pointer"
              >
                <span>{slide.ctaText}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/products"
                className="px-5 py-3.5 bg-slate-800/80 hover:bg-slate-700/80 text-white font-semibold rounded-2xl text-sm border border-slate-700 transition"
              >
                Browse Catalog
              </Link>
            </div>
          </div>

          {/* Stats Bar at bottom */}
          <div className="relative z-10 mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-3 gap-2 sm:gap-4 max-w-md">
            {slide.stats.map((stat, i) => (
              <div key={i} className="hero-stat-card flex flex-col">
                <span className="text-base sm:text-lg font-black text-white">
                  {stat.value}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Slide Navigation Dots & Arrows */}
          <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
            <button
              onClick={() =>
                setCurrentSlideIndex(
                  (prev) => (prev - 1 + SLIDES.length) % SLIDES.length
                )
              }
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center transition border border-slate-700"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1.5 px-2">
              {SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    currentSlideIndex === idx
                      ? "w-6 bg-white"
                      : "w-2 bg-slate-600 hover:bg-slate-400"
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
            <button
              onClick={() =>
                setCurrentSlideIndex((prev) => (prev + 1) % SLIDES.length)
              }
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center transition border border-slate-700"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SIDE PROMOTIONAL PANELS (AliExpress / Daraz Style) */}
        <div className="lg:col-span-4 flex flex-col gap-6 justify-between">
          {/* Welcome Gift Card */}
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between flex-1 border border-amber-400/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-100 mb-2">
                <Gift className="w-4 h-4" />
                <span>New User Bonus</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight leading-snug">
                Claim $15 Off Your First Order
              </h3>
              <p className="text-xs text-amber-100 mt-2">
                Use code <strong className="bg-black/20 px-2 py-0.5 rounded text-white font-mono">WELCOME15</strong> at checkout.
              </p>
            </div>

            <div className="mt-6">
              <Link
                href="/products"
                className="w-full py-2.5 px-4 bg-white text-orange-600 font-bold rounded-xl text-xs hover:bg-amber-50 text-center block shadow-md transition"
              >
                Claim Voucher Now
              </Link>
            </div>
          </div>

          {/* Buyer Protection Guarantee Card */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 flex flex-col justify-between flex-1">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Larekmart Buyer Protection
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Full refund if your item doesn&apos;t arrive or is not as described. 100% secure escrow payments.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>30-Day Free Returns</span>
              </div>
              <Link
                href="/return"
                className="text-indigo-600 font-bold hover:underline"
              >
                Learn More &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
