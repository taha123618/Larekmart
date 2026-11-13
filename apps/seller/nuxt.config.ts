// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-01",
  devtools: { enabled: true },
  telemetry: false,

  // Dev server configuration: Bind to dual-stack IPv4/IPv6 so localhost resolves cleanly
  devServer: {
    host: "::",
    port: 3004,
  },

  // Source directory
  srcDir: "app/",

  // Server-side rendering
  ssr: true,

  // Experimental flags
  experimental: {
    appManifest: false,
  },

  // Modules
  modules: ["@nuxt/ui", "@pinia/nuxt", "@vueuse/nuxt"],

  // CSS
  css: ["~/assets/css/main.css"],

  // Runtime config
  runtimeConfig: {
    // Server-only
    apiGatewayUrl: process.env.NUXT_API_GATEWAY_URL || "http://localhost:8090",
    clerkSecretKey: process.env.CLERK_SECRET_KEY || "",

    // Public (exposed to client)
    public: {
      apiGatewayUrl:
        process.env.NUXT_PUBLIC_API_GATEWAY_URL || "http://localhost:8090",
      wsUrl: process.env.NUXT_PUBLIC_WS_URL || "http://localhost:8090",
      clerkPublishableKey:
        process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
        "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k",
      appEnv: process.env.NODE_ENV || "development",
    },
  },

  // Nitro configuration
  nitro: {
    routeRules: {
      // Global defensive security headers
      "/**": {
        headers: {
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "X-XSS-Protection": "1; mode=block",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        },
      },
      // Proxy API calls to gateway in SSR
      "/api/v1/**": {
        proxy: `${process.env.NUXT_API_GATEWAY_URL || "http://localhost:8090"}/api/v1/**`,
      },
      "/socket.io/**": {
        proxy: `${process.env.NUXT_API_GATEWAY_URL || "http://localhost:8090"}/socket.io/**`,
      },
      // Health endpoint
      "/api/health": {
        cors: true,
      },
    },
  },

  // Vite config for dev proxy and client builds
  vite: {
    server: {
      hmr: {
        port: 24678,
      },
      proxy: {
        "/api/v1": {
          target: "http://localhost:8090",
          changeOrigin: true,
        },
        "/socket.io": {
          target: "http://localhost:8090",
          ws: true,
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      include: ["echarts", "vue-echarts"],
    },
  },

  // App configuration
  app: {
    head: {
      title: "LarekMart Seller Dashboard",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "LarekMart Seller Dashboard — Manage your marketplace store",
        },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
  },

  // TypeScript
  typescript: {
    strict: true,
    typeCheck: false, // Use nuxt typecheck script separately
  },

  // Nuxt UI color mode
  colorMode: {
    classSuffix: "",
    preference: "system",
    fallback: "light",
  },
});
