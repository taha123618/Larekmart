<script setup lang="ts">
import { useHead } from "#imports";

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk
      ? `${titleChunk} — LarekMart Seller Central`
      : "LarekMart Seller Central";
  },
  meta: [
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#2563eb" },
  ],
  link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
});
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator color="#2563eb" :height="3" />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Global Nuxt UI Notifications / Toasts container -->
    <UNotifications />
  </div>
</template>
