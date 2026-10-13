"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { getTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type AnimationVariant = "circle" | "circle-blur" | "polygon";

type StartPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ThemeToggleAnimatedProps {
  /**
   * Size variant for the toggle button
   * @default 'default'
   */
  size?: "sm" | "default" | "lg";
  /**
   * Custom className for the button
   */
  className?: string;
  /**
   * Show icon only or with text
   * @default true
   */
  iconOnly?: boolean;
  /**
   * Animation variant
   * @default 'circle-blur'
   */
  variant?: AnimationVariant;
  /**
   * Start position for the animation
   */
  start?: StartPosition;
}

/**
 * Hook for using View Transitions API
 */
const useThemeTransition = () => {
  const startTransition = useCallback((updateFn: () => void) => {
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      document.startViewTransition(updateFn);
    } else {
      updateFn();
    }
  }, []);

  return { startTransition };
};

export default function ThemeToggleAnimated({
  size = "default",
  className = "",
  iconOnly = true,
  variant = "circle-blur",
  start,
}: ThemeToggleAnimatedProps) {
  const { setTheme: setNextTheme, resolvedTheme } = useTheme();
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [mounted, setMounted] = useState(false);
  const { startTransition } = useThemeTransition();

  useEffect(() => {
    setMounted(true);
    const initialTheme = (resolvedTheme as Theme) || getTheme();
    setThemeState(initialTheme);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "theme" && e.newValue) {
        const newTheme = e.newValue as Theme;
        setThemeState(newTheme);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [resolvedTheme]);

  const injectAnimationStyles = useCallback(
    (animVariant: AnimationVariant, startPosition: StartPosition) => {
      const styleId = `theme-transition-${Math.random().toString(36).substring(2, 9)}`;
      let style = document.getElementById(styleId) as HTMLStyleElement;

      if (!style) {
        style = document.createElement("style");
        style.id = styleId;
      }

      const positions: Record<StartPosition, string> = {
        center: "center",
        "top-left": "top left",
        "top-right": "top right",
        "bottom-left": "bottom left",
        "bottom-right": "bottom right",
      };

      let css = "";

      if (animVariant === "circle") {
        const cx =
          startPosition === "center"
            ? "50"
            : startPosition.includes("left")
              ? "0"
              : "100";
        const cy =
          startPosition === "center"
            ? "50"
            : startPosition.includes("top")
              ? "0"
              : "100";
        css = `
        @supports (view-transition-name: root) {
          ::view-transition-group(root) {
            animation-duration: 0.75s;
            animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }
          ::view-transition-old(root) {
            animation: fade-out-smooth 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            mix-blend-mode: normal;
          }
          ::view-transition-new(root) {
            animation: circle-expand-smooth 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            transform-origin: ${positions[startPosition]};
            mix-blend-mode: normal;
          }
          @keyframes fade-out-smooth {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          @keyframes circle-expand-smooth {
            from {
              clip-path: circle(0% at ${cx}% ${cy}%);
              opacity: 0;
            }
            15% { opacity: 1; }
            to {
              clip-path: circle(150% at ${cx}% ${cy}%);
              opacity: 1;
            }
          }
        }
      `;
      } else if (animVariant === "circle-blur") {
        const cx =
          startPosition === "center"
            ? "50"
            : startPosition.includes("left")
              ? "0"
              : "100";
        const cy =
          startPosition === "center"
            ? "50"
            : startPosition.includes("top")
              ? "0"
              : "100";
        css = `
        @supports (view-transition-name: root) {
          ::view-transition-group(root) {
            animation-duration: 0.85s;
            animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
            will-change: transform;
          }
          ::view-transition-old(root) {
            animation: fade-out-blur 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            mix-blend-mode: normal;
            will-change: opacity, filter;
          }
          ::view-transition-new(root) {
            animation: circle-blur-expand-smooth 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            transform-origin: ${positions[startPosition]};
            mix-blend-mode: normal;
            will-change: clip-path, filter, opacity;
          }
          @keyframes fade-out-blur {
            from { opacity: 1; filter: blur(0); }
            to { opacity: 0; filter: blur(6px); }
          }
          @keyframes circle-blur-expand-smooth {
            from {
              clip-path: circle(0% at ${cx}% ${cy}%);
              filter: blur(14px);
              opacity: 0;
            }
            15% { opacity: 0.6; filter: blur(10px); }
            35% { opacity: 0.85; filter: blur(6px); }
            65% { opacity: 0.95; filter: blur(3px); }
            to {
              clip-path: circle(150% at ${cx}% ${cy}%);
              filter: blur(0);
              opacity: 1;
            }
          }
        }
      `;
      } else if (animVariant === "polygon") {
        css = `
        @supports (view-transition-name: root) {
          ::view-transition-old(root) {
            animation: none;
          }
          ::view-transition-new(root) {
            animation: ${theme === "light" ? "wipe-in-dark" : "wipe-in-light"} 0.5s ease-out;
          }
          @keyframes wipe-in-dark {
            from { clip-path: polygon(0 0, 0 0, 0 100%, 0 100%); }
            to { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
          }
          @keyframes wipe-in-light {
            from { clip-path: polygon(100% 0, 100% 0, 100% 100%, 100% 100%); }
            to { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
          }
        }
      `;
      }

      if (css) {
        style.textContent = css;
        if (!document.getElementById(styleId)) {
          document.head.appendChild(style);
        }

        setTimeout(() => {
          const styleEl = document.getElementById(styleId);
          if (styleEl) {
            styleEl.remove();
          }
        }, 1500);
      }
    },
    [theme],
  );

  const handleToggle = useCallback(() => {
    const currentTheme = (resolvedTheme as Theme) || theme || getTheme();
    const newTheme: Theme = currentTheme === "dark" ? "light" : "dark";

    const dynamicStart: StartPosition =
      start !== undefined
        ? start
        : newTheme === "dark"
          ? "top-right"
          : "bottom-left";

    if (typeof document !== "undefined") {
      injectAnimationStyles(variant, dynamicStart);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          startTransition(() => {
            const root = document.documentElement;
            root.style.willChange = "background-color, color";

            if (newTheme === "dark") {
              root.classList.add("dark");
            } else {
              root.classList.remove("dark");
            }

            if (typeof window !== "undefined") {
              window.localStorage.setItem("theme", newTheme);
            }
            if (setNextTheme) {
              setNextTheme(newTheme);
            }

            requestAnimationFrame(() => {
              setTimeout(() => {
                root.style.willChange = "auto";
              }, 950);
            });

            setThemeState(newTheme);
            window.dispatchEvent(
              new CustomEvent("themechange", { detail: newTheme }),
            );
          });
        });
      });
    } else {
      setThemeState(newTheme);
      if (setNextTheme) {
        setNextTheme(newTheme);
      }
    }
  }, [
    theme,
    resolvedTheme,
    setNextTheme,
    variant,
    start,
    injectAnimationStyles,
    startTransition,
  ]);

  const sizeClasses = {
    sm: "h-8 w-8 p-1.5",
    default: "h-9 w-9 p-2",
    lg: "h-10 w-10 p-2.5",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    default: "h-4 w-4",
    lg: "h-5 w-5",
  };

  if (!mounted) {
    return (
      <div
        suppressHydrationWarning
        className={cn(
          "rounded-xl border border-border/80 bg-secondary/50 flex items-center justify-center",
          sizeClasses[size],
          className,
        )}
      >
        <div
          suppressHydrationWarning
          className={cn("rounded-full bg-muted animate-pulse", iconSizes[size])}
        />
      </div>
    );
  }

  const isDark = theme === "dark" || resolvedTheme === "dark";

  return (
    <button
      onClick={handleToggle}
      data-magnetic
      className={cn(
        "rounded-xl border border-border/80 bg-card hover:bg-secondary/60 text-foreground transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center shadow-xs cursor-pointer",
        sizeClasses[size],
        className,
      )}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      type="button"
      style={{
        position: "relative",
        overflow: "visible",
        willChange: "transform",
        backfaceVisibility: "hidden",
        transform: "translateZ(0)",
      }}
    >
      {isDark ? (
        <Moon
          className={cn(
            "text-primary transition-transform duration-300 rotate-0",
            iconSizes[size],
          )}
        />
      ) : (
        <Sun
          className={cn(
            "text-amber-500 transition-transform duration-300 rotate-0",
            iconSizes[size],
          )}
        />
      )}
      {!iconOnly && (
        <span className="ml-2 text-xs font-semibold">
          {isDark ? "Dark" : "Light"}
        </span>
      )}
    </button>
  );
}

export { ThemeToggleAnimated };
