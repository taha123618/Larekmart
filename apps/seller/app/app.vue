<script setup lang="ts">
useHead({
  titleTemplate: (titleChunk?: string) => {
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
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator color="#2563eb" :height="3" />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
