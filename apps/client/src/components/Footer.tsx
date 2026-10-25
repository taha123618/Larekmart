/* eslint-disable @next/next/no-page-custom-font */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { useUser } from "@clerk/nextjs";
import { fetchSystemSettings } from "@/services/seller.service";

// Static constants hoisted outside of component scope to eliminate re-allocation overhead
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
const SCRAMBLE_DURATION = 1200; // ms
const SCRAMBLE_LOOP_INTERVAL = 6000; // ms

const SPRING_HOVER_TRANSITION = {
  type: "spring",
  stiffness: 400,
  damping: 25,
} as const;

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly count?: string;
}

interface SocialItem {
  readonly label: string;
  readonly href: string;
}

const STATIC_NAV_LINKS: readonly NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Super Deals", href: "/#flash-deals", count: "[HOT]" },
  { label: "All Products", href: "/products", count: "[SHOP]" },
  { label: "Track Shipment", href: "/track" },
  { label: "My Orders", href: "/orders" },
  { label: "Returns & Refunds", href: "/account/returns" },
  { label: "Customer Care", href: "/return" },
  { label: "Become a Seller", href: "/become-a-seller", count: "[SELL]" },
];

const STATIC_DEPARTMENT_LINKS: readonly NavItem[] = [
  { label: "Men's Fashion", href: "/products?category=mens-clothing" },
  { label: "Women's Fashion", href: "/products?category=womens-clothing" },
  { label: "Footwear", href: "/products?category=shoes" },
  { label: "Electronics", href: "/products?category=electronics" },
  { label: "Sports & Gear", href: "/products?category=sports" },
];

const STATIC_SOCIAL_LINKS: readonly SocialItem[] = [
  { label: "Twitter (X)", href: "https://x.com" },
  { label: "LinkedIn", href: "https://linkedin.com" },
  { label: "Discord", href: "https://discord.gg" },
  { label: "Instagram", href: "https://instagram.com" },
];

interface ShuffleTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

// Memoized ShuffleText component to prevent unnecessary re-evaluations during parent renders
const ShuffleText = React.memo(function ShuffleText({
  text,
  className,
  style,
}: ShuffleTextProps) {
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    let animationFrameId: number;
    let startTime: number | null = null;
    let isCancelled = false;

    const runScramble = () => {
      startTime = null;

      const step = (timestamp: number) => {
        if (isCancelled) return;
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / SCRAMBLE_DURATION, 1);

        let scrambled = "";
        for (let i = 0; i < text.length; i++) {
          if (text[i] === " ") {
            scrambled += " ";
          } else if (progress > i / text.length) {
            scrambled += text[i];
          } else {
            scrambled +=
              SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }
        }

        setDisplayText(scrambled);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        }
      };

      animationFrameId = requestAnimationFrame(step);
    };

    runScramble();
    const intervalId = setInterval(runScramble, SCRAMBLE_LOOP_INTERVAL);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
      clearInterval(intervalId);
    };
  }, [text]);

  return (
    <span className={className} style={style}>
      {displayText}
    </span>
  );
});

function FooterComponent() {
  const [time, setTime] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Stabilize real-time clock effect with strict lifecycle cleanup
  useEffect(() => {
    let isMounted = true;

    const updateClock = () => {
      if (!isMounted) return;
      try {
        const now = new Date();
        const globalTime = now.toLocaleTimeString("en-US", {
          timeZone: "UTC",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        setTime(`${globalTime} UTC`);
      } catch {
        setTime("12:00:00 UTC");
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Memoized submission handler
  const handleSubscribe = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim() || !email.includes("@")) {
        toast.error("Please enter a valid email address");
        return;
      }

      setSubmitted(true);
      toast.success(
        "Thank you for subscribing! Your $10 coupon code is on its way.",
      );
      const timer = setTimeout(() => {
        setEmail("");
        setSubmitted(false);
      }, 4000);

      return () => clearTimeout(timer);
    },
    [email],
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
    },
    [],
  );

  const { user } = useUser();
  const isSeller = Boolean(
    user?.publicMetadata?.isSeller ||
      user?.unsafeMetadata?.isSeller ||
      user?.publicMetadata?.role === "seller",
  );

  const [isSellerEnabled, setIsSellerEnabled] = useState(true);
  const [isSellerRegistrationOpen, setIsSellerRegistrationOpen] =
    useState(true);

  useEffect(() => {
    fetchSystemSettings()
      .then((settings) => {
        setIsSellerEnabled(settings.isSellerEnabled);
        setIsSellerRegistrationOpen(settings.isSellerRegistrationOpen);
      })
      .catch(() => {
        setIsSellerEnabled(true);
        setIsSellerRegistrationOpen(true);
      });
  }, []);

  // Memoized navigation, department, and social lists
  const navLinks = useMemo(
    () =>
      STATIC_NAV_LINKS.flatMap((item) => {
        if (item.href === "/become-a-seller") {
          if (!isSellerEnabled) return [];
          if (isSeller) {
            return [
              {
                label: "Seller Portal",
                href: "/become-a-seller",
                count: "[PORTAL]",
              },
            ];
          }
          if (!isSellerRegistrationOpen) return [];
          return [item];
        }
        return [item];
      }),
    [isSellerEnabled, isSellerRegistrationOpen, isSeller],
  );
  const departmentLinks = useMemo(() => STATIC_DEPARTMENT_LINKS, []);
  const socialLinks = useMemo(() => STATIC_SOCIAL_LINKS, []);

  return (
    <>
      {/* Scoped Google Font: Barlow Condensed */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&display=swap"
        rel="stylesheet"
        crossOrigin="anonymous"
      />

      <style>{`
        [data-footer-condensed] {
          font-family: 'Barlow Condensed', sans-serif;
        }
      `}</style>

      <footer
        className="w-full bg-card text-card-foreground overflow-hidden select-none border-t border-border/80 transition-colors duration-300 mt-20"
        style={{ fontFamily: "sans-serif" }}
      >
        {/* Section 1 — Top footer grid */}
        <div className="px-6 md:px-10 pt-20 pb-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Column 1 — Brand Logo & Contact */}
            <div className="flex flex-col justify-between">
              <div>
                <Link
                  href="/"
                  className="flex items-center gap-3 shrink-0 group mb-6"
                >
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-border group-hover:scale-105 transition">
                    <Image
                      src="/logo.png"
                      alt="Larekmart"
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black tracking-tight text-foreground group-hover:text-primary transition">
                      LAREKMART<span className="text-primary">.</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground -mt-1 font-mono">
                      Marketplace
                    </span>
                  </div>
                </Link>

                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs font-mono">
                  Global multi-vendor marketplace connecting verified sellers
                  with millions of shoppers worldwide.
                </p>
              </div>

              {/* Email contact block */}
              <div className="mt-12 md:mt-0">
                <div className="text-[11px] text-muted-foreground tracking-[0.1em] mb-2 font-mono uppercase">
                  {"// SHOOT US AN EMAIL"}
                </div>
                <a
                  href="mailto:support@larekmart.com"
                  className="text-[15px] text-foreground hover:text-primary transition-colors duration-300 font-medium font-mono"
                >
                  support@larekmart.com
                </a>
              </div>
            </div>

            {/* Column 2 — Navigation */}
            <div>
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 bg-primary shrink-0" />
                <span className="text-[11px] text-muted-foreground tracking-[0.1em] uppercase font-mono">
                  Navigation
                </span>
              </div>

              {/* Stacked Links */}
              <div className="flex flex-col gap-1" data-footer-condensed>
                {navLinks.map((item) => (
                  <motion.div
                    key={item.label}
                    whileHover={{ x: 10 }}
                    transition={SPRING_HOVER_TRANSITION}
                  >
                    <Link
                      href={item.href}
                      data-magnetic
                      className="text-[28px] md:text-[38px] font-medium leading-[1.1] uppercase text-foreground hover:text-primary transition-colors inline-flex items-baseline cursor-pointer"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      <span>{item.label}</span>
                      {item.count && (
                        <span className="text-[16px] text-primary/80 font-bold lowercase tracking-tight ml-2">
                          {item.count}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Column 3 — Departments */}
            <div>
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 bg-primary shrink-0" />
                <span className="text-[11px] text-muted-foreground tracking-[0.1em] uppercase font-mono">
                  Departments
                </span>
              </div>

              {/* Stacked Links */}
              <div className="flex flex-col gap-1" data-footer-condensed>
                {departmentLinks.map((dept) => (
                  <motion.div
                    key={dept.label}
                    whileHover={{ x: 10 }}
                    transition={SPRING_HOVER_TRANSITION}
                  >
                    <Link
                      href={dept.href}
                      data-magnetic
                      className="text-[28px] md:text-[38px] font-medium leading-[1.1] uppercase text-foreground hover:text-primary transition-colors inline-block cursor-pointer"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      {dept.label}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Column 4 — Socials */}
            <div>
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 bg-primary shrink-0" />
                <span className="text-[11px] text-muted-foreground tracking-[0.1em] uppercase font-mono">
                  Socials
                </span>
              </div>

              {/* Stacked Links */}
              <div className="flex flex-col gap-1" data-footer-condensed>
                {socialLinks.map((social) => (
                  <motion.div
                    key={social.label}
                    whileHover={{ x: 10 }}
                    transition={SPRING_HOVER_TRANSITION}
                  >
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-magnetic
                      className="text-[28px] md:text-[38px] font-medium leading-[1.1] uppercase text-foreground hover:text-primary transition-colors inline-block cursor-pointer"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      {social.label}
                    </a>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 — Newsletter row */}
        <div className="px-6 md:px-10 pb-16 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 items-end">
            {/* Col A */}
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary shrink-0" />
              <span className="text-[11px] text-muted-foreground tracking-[0.1em] uppercase font-mono">
                VIP Newsletter
              </span>
            </div>

            {/* Col B */}
            <div>
              <p className="text-[11px] text-muted-foreground tracking-[0.1em] uppercase font-mono">
                {"// Get $10 off your order & secret coupons"}
              </p>
            </div>

            {/* Col C */}
            <div className="md:col-span-2">
              <form
                onSubmit={handleSubscribe}
                className="border-b border-border/80 pb-3 sm:pb-2 focus-within:border-primary transition-colors duration-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4"
              >
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder={
                    submitted
                      ? "Thank you for subscribing!"
                      : "Enter your email address..."
                  }
                  required
                  className="bg-transparent text-[13px] sm:text-[14px] py-2 placeholder:text-muted-foreground/60 text-foreground focus:outline-none w-full font-mono"
                />
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground font-bold text-[11px] sm:text-[12px] tracking-[0.1em] uppercase px-5 sm:px-6 py-2.5 relative cursor-pointer hover:bg-primary/90 transition-all duration-200 active:scale-95 shrink-0 flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <span>{submitted ? "Joined" : "Subscribe"}</span>
                  <span className="w-1.5 h-1.5 bg-primary-foreground inline-block" />
                  {/* Absolute dashed outline overlay */}
                  <div className="absolute -inset-1 border border-dashed border-primary/40 pointer-events-none" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Section 3 — Brand block */}
        <div className="px-4 sm:px-6 md:px-10 max-w-7xl mx-auto">
          <div className="border border-border/80 relative overflow-hidden bg-card/60 backdrop-blur-sm">
            {/* Corner Brackets */}
            <div className="w-4 sm:w-5 h-4 sm:h-5 border-t-2 border-l-2 border-foreground/30 absolute top-0 left-0 pointer-events-none" />
            <div className="w-4 sm:w-5 h-4 sm:h-5 border-t-2 border-r-2 border-foreground/30 absolute top-0 right-0 pointer-events-none" />
            <div className="w-4 sm:w-5 h-4 sm:h-5 border-b-2 border-l-2 border-foreground/30 absolute bottom-0 left-0 pointer-events-none" />
            <div className="w-4 sm:w-5 h-4 sm:h-5 border-b-2 border-r-2 border-foreground/30 absolute bottom-0 right-0 pointer-events-none" />

            {/* Massive Brand Word with ShuffleText scramble */}
            <div
              className="py-6 sm:py-10 px-2 sm:px-4 flex justify-center items-center overflow-hidden min-h-[100px] sm:min-h-[160px] md:min-h-[260px] lg:min-h-[340px]"
              data-footer-condensed
            >
              <ShuffleText
                text="LAREKMART"
                className="font-bold text-foreground/80 text-[42px] xs:text-[60px] sm:text-[110px] md:text-[180px] lg:text-[250px] xl:text-[300px] leading-[0.85] tracking-[-0.05em] whitespace-nowrap uppercase font-['Barlow_Condensed',sans-serif]"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              />
            </div>
          </div>
        </div>

        {/* Section 4 — Bottom bar */}
        <div className="mt-8 border-t border-dashed border-border/80">
          <div className="px-6 md:px-10 py-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Left Copyright & Clock */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground tracking-[0.08em] uppercase font-mono">
              <span>
                &copy; {new Date().getFullYear()} LAREKMART&trade; // All Rights
                Reserved
              </span>
              {time && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-primary font-bold">{time}</span>
                </>
              )}
            </div>

            {/* Guaranteed Safe Checkout Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                Guaranteed Safe Checkout:
              </span>
              <div className="flex items-center gap-1.5">
                {["STRIPE", "VISA", "MASTERCARD", "APPLE PAY", "COD"].map(
                  (method) => (
                    <span
                      key={method}
                      className="px-2 py-0.5 rounded-md border border-border/80 bg-background text-[10px] font-mono font-bold text-foreground/80"
                    >
                      {method}
                    </span>
                  ),
                )}
              </div>
            </div>

            {/* Right Links */}
            <div className="flex gap-6 text-[12px] font-mono tracking-wider">
              <span className="text-muted-foreground">
                <Link
                  href="/return"
                  className="text-foreground underline decoration-primary hover:text-primary transition-colors"
                >
                  Returns & Refunds
                </Link>
              </span>
              <span className="text-muted-foreground">
                Platform by{" "}
                <Link
                  href="/"
                  className="text-foreground underline decoration-primary decoration-1 hover:text-primary transition-colors"
                >
                  Larekmart
                </Link>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// Export top-level memoized Footer to avoid unnecessary re-renders in parent layouts
export default React.memo(FooterComponent);
