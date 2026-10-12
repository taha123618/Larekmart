"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, Variants } from "framer-motion";
import {
  Wrench,
  Clock,
  Mail,
  ShieldAlert,
  Heart,
  Settings,
  ArrowRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

interface MaintenanceContentProps {
  message: string;
  estimatedCompletion: string | null;
}

export function MaintenanceContent({
  message,
  estimatedCompletion,
}: MaintenanceContentProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
  } | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  // Guard against triggering the redirect more than once
  const redirectScheduled = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    if (!estimatedCompletion) return;

    const calculateTimeLeft = () => {
      const difference = +new Date(estimatedCompletion) - +new Date();
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        total: difference,
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      // When the timer expires, perform a hard navigation to home.
      // The proxy will re-evaluate the maintenance status from Redis/DB;
      // if estimatedCompletion has passed the admin should have disabled
      // maintenance mode by then, and users will reach the site normally.
      if (remaining.total <= 0 && !redirectScheduled.current) {
        redirectScheduled.current = true;
        clearInterval(timer);
        // Small grace period so the last "00" frame is visible
        setTimeout(() => {
          // router.push navigates client-side; window.location forces a full
          // server round-trip so the proxy maintenance check runs fresh.
          window.location.href = "/";
        }, 2000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [estimatedCompletion]);

  // Premium background animations
  const bgVariants: Variants = {
    animate: {
      scale: [1, 1.05, 1],
      rotate: [0, 3, 0],
      transition: {
        duration: 20,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background px-4 py-16 mesh-gradient selection:bg-primary/20 selection:text-foreground">
      {/* Background Glow Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]"
          variants={bgVariants}
          animate="animate"
        />
        <motion.div
          className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[120px]"
          variants={bgVariants}
          animate="animate"
          style={{ transitionDelay: "2s" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center space-y-12">
        {/* Animated Icon Container */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Outer pulsing ring */}
            <motion.div
              className="absolute -inset-4 rounded-full border border-primary/20 bg-primary/5"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            {/* Inner pulsing ring */}
            <motion.div
              className="absolute -inset-1 rounded-full border border-primary/40 bg-primary/10"
              animate={{
                scale: [1, 1.08, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
            />
            {/* Core Box */}
            <motion.div
              className="relative h-24 w-24 rounded-2xl bg-card border border-border/80 flex items-center justify-center shadow-2xl"
              initial={{ rotate: -15, scale: 0.8, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 15 }}
            >
              <Wrench className="h-10 w-10 text-primary animate-float" />
              <Settings className="absolute bottom-2 right-2 h-5 w-5 text-muted-foreground animate-spin-slow" />
            </motion.div>
          </div>
        </div>

        {/* Headings */}
        <div className="space-y-4">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
              <ShieldAlert className="h-3.5 w-3.5" />
              Maintenance Mode
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl font-black tracking-tight text-foreground leading-tight"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            We&apos;ll be back soon
          </motion.h1>

          <motion.p
            className="text-muted-foreground font-medium text-lg max-w-lg mx-auto leading-relaxed"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            {message}
          </motion.p>
        </div>

        {/* Countdown Timer */}
        {isMounted && timeLeft && timeLeft.total > 0 && (
          <motion.div
            className="glass-card premium-border border-0 bg-card/25 backdrop-blur-xl p-8 rounded-3xl shadow-2xl max-w-xl mx-auto"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-6 justify-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Clock className="h-4 w-4 text-primary animate-pulse" />
              Estimated Time Remaining
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Days", value: timeLeft.days },
                { label: "Hours", value: timeLeft.hours },
                { label: "Mins", value: timeLeft.minutes },
                { label: "Secs", value: timeLeft.seconds },
              ].map((unit, index) => (
                <div
                  key={unit.label}
                  className="relative flex flex-col items-center"
                >
                  <div className="w-full h-16 sm:h-20 rounded-2xl bg-card border border-border/80 flex items-center justify-center shadow-lg">
                    <span className="text-2xl sm:text-4xl font-black tracking-tighter text-foreground">
                      {String(unit.value).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-muted-foreground mt-2">
                    {unit.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Contact/Support Links */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <a
            href="mailto:support@larekmart.com"
            className={buttonVariants({
              variant: "outline",
              className:
                "w-full sm:w-auto rounded-xl font-black px-6 gap-2 border-border/60 hover:bg-muted/80",
            })}
          >
            <Mail className="h-4 w-4" />
            Contact Support
          </a>

          <Link
            href="/"
            className={buttonVariants({
              variant: "ghost",
              className:
                "w-full sm:w-auto rounded-xl font-black px-6 gap-2 hover:bg-muted/40",
            })}
          >
            Check Status
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="text-xs font-bold text-muted-foreground/60 flex items-center justify-center gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> by
          your team
        </motion.div>
      </div>
    </div>
  );
}
