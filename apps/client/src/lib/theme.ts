/**
 * Theme management utility
 * Handles dark/light theme switching with localStorage persistence
 */

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

/**
 * Get the current theme from localStorage or system preference
 */
export function getTheme(): Theme {
  if (typeof window === "undefined") {
    return "light"; // SSR fallback
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  // Fallback to system preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Set theme in localStorage and apply to document
 */
export function setTheme(theme: Theme, animated: boolean = true): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme, animated);
}

/**
 * Toggle between light and dark theme
 */
export function toggleTheme(animated: boolean = true): Theme {
  const currentTheme = getTheme();
  const newTheme: Theme = currentTheme === "dark" ? "light" : "dark";
  setTheme(newTheme, animated);
  return newTheme;
}

/**
 * Apply theme to document root with smooth transition
 */
export function applyTheme(theme: Theme, animated: boolean = true): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const isDark = theme === "dark";
  const wasDark = root.classList.contains("dark");

  // Skip animation if already in the target theme
  if (isDark === wasDark) {
    if (!isDark) {
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
    }
    return;
  }

  if (animated) {
    // Create or get transition overlay
    let overlay = document.getElementById("theme-transition-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "theme-transition-overlay";
      overlay.className = "theme-transition-overlay";
      document.body.appendChild(overlay);
    }

    // Set overlay background based on target theme with smooth gradient
    if (isDark) {
      overlay.style.background =
        "linear-gradient(135deg, rgba(17, 24, 39, 0.85) 0%, rgba(15, 23, 42, 0.85) 100%)";
    } else {
      overlay.style.background =
        "linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(248, 250, 252, 0.85) 100%)";
    }

    // Apply theme change first (will animate via CSS)
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Trigger overlay fade-in for smooth transition (double RAF for smoother start)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay?.classList.add("active");

        // Fade out overlay after colors have transitioned (synchronized with CSS transition)
        // Overlay stays visible for first 350ms, then fades out over 500ms
        setTimeout(() => {
          overlay?.classList.remove("active");
          // Remove overlay after fade-out completes
          setTimeout(() => {
            if (overlay && !overlay.classList.contains("active")) {
              overlay.remove();
            }
          }, 550); // Wait for fade-out animation to complete (500ms + 50ms buffer)
        }, 350); // Start fade-out after overlay is visible, synced with color transition midpoint
      });
    });
  } else {
    // No animation, just apply theme
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

/**
 * Initialize theme on page load (call this before DOMContentLoaded)
 * This prevents FOUC (Flash of Unstyled Content)
 */
export function initTheme(): void {
  const theme = getTheme();
  applyTheme(theme);
}

/**
 * Watch for system theme changes and update if no manual preference is set
 */
export function watchSystemTheme(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handler = (e: MediaQueryListEvent) => {
    // Only apply system theme if user hasn't set a manual preference
    if (!window.localStorage.getItem(THEME_STORAGE_KEY)) {
      applyTheme(e.matches ? "dark" : "light");
    }
  };

  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }

  // Legacy browsers
  mediaQuery.addListener(handler);
  return () => mediaQuery.removeListener(handler);
}
