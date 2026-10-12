"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import type Lenis from "lenis";
import { ArrowUp } from "lucide-react";

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // High-performance scroll tracking supporting both native scroll and Lenis
  useEffect(() => {
    let ticking = false;

    const updateScrollMetrics = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        scrollHeight > 0 ? Math.min(1, Math.max(0, scrollY / scrollHeight)) : 0;

      setScrollProgress(progress);

      if (scrollY > 400) {
        setIsVisible(true);
      } else if (scrollY < 200) {
        setIsVisible(false);
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollMetrics);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateScrollMetrics();

    // Hook into Lenis if available
    const lenis = (window as unknown as { lenis?: Lenis }).lenis;
    const handleLenisScroll = () => {
      handleScroll();
    };

    if (lenis && typeof lenis.on === "function") {
      lenis.on("scroll", handleLenisScroll);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (lenis && typeof lenis.off === "function") {
        lenis.off("scroll", handleLenisScroll);
      }
    };
  }, []);

  // Smooth scroll to top
  const scrollToTop = useCallback(() => {
    const lenis = (window as unknown as { lenis?: Lenis }).lenis;

    if (lenis && typeof lenis.scrollTo === "function") {
      lenis.scrollTo(0, {
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else if (typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, []);

  // Calculate SVG circular stroke properties
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - scrollProgress * circumference;

  return (
    <>
      {/* Top viewport reading/scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 origin-left z-50 pointer-events-none shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-opacity duration-300"
        style={{
          scaleX: scrollProgress,
          opacity: scrollProgress > 0.01 ? 1 : 0,
        }}
      />

      {/* Floating Scroll To Top Button */}
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40">
        <AnimatePresence>
          {isVisible && (
            <motion.button
              onClick={scrollToTop}
              className="group relative flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-full"
              aria-label="Scroll to top of page"
              initial={{ opacity: 0, scale: 0.6, y: 16 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                transition: { type: "spring", damping: 18, stiffness: 350 },
              }}
              exit={{
                opacity: 0,
                scale: 0.6,
                y: 16,
                transition: { duration: 0.2 },
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
            >
              {/* Outer ambient glow halo */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />

              {/* Progress ring SVG */}
              <svg
                className="absolute w-14 h-14 -rotate-90 pointer-events-none"
                viewBox="0 0 52 52"
              >
                {/* Background track */}
                <circle
                  cx="26"
                  cy="26"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-slate-200/90 dark:text-slate-800/90"
                />
                {/* Animated active progress indicator */}
                <circle
                  cx="26"
                  cy="26"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="text-indigo-600 dark:text-indigo-400"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: strokeDashoffset,
                    transition: "stroke-dashoffset 0.1s linear",
                  }}
                />
              </svg>

              {/* Glassmorphic button core */}
              <div className="relative w-11 h-11 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-900/10 dark:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.7),0_0_12px_-2px_rgba(99,102,241,0.25)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] flex items-center justify-center overflow-hidden group-hover:border-indigo-400/50 dark:group-hover:border-indigo-500/50 transition-colors duration-300">
                {/* Subtle gradient hover wash */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Arrow icon */}
                <ArrowUp className="relative w-4.5 h-4.5 text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:-translate-y-0.5 transition-all duration-300" />
              </div>

              {/* Interactive Tooltip badge */}
              <div className="hidden sm:flex absolute right-full mr-3.5 px-2.5 py-1 bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-md border border-slate-700/50 dark:border-slate-700/80 rounded-lg text-xs font-semibold text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 translate-x-1.5 group-hover:translate-x-0 transition-all duration-200 shadow-xl items-center gap-1.5">
                <span>Top</span>
                <span className="text-[10px] text-indigo-300 font-mono">
                  {Math.round(scrollProgress * 100)}%
                </span>
                {/* Tiny arrow */}
                <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900/90 dark:bg-slate-800/95 border-r border-b border-slate-700/50 rotate-[-45deg]" />
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default ScrollToTop;
