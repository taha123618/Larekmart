<script setup lang="ts">
definePageMeta({
  middleware: [
    "seller-access",
    () => {
      return navigateTo("/chat", { redirectCode: 301 });
    },
  ],
});
</script>

<template>
  <div class="flex items-center justify-center p-12">
    <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-primary-600" />
  </div>
</template>
