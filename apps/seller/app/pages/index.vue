<script setup lang="ts">
// Index page automatically redirects to /dashboard
definePageMeta({
  middleware: [
    function () {
      return navigateTo("/dashboard");
    },
  ],
});
</script>

<template>
  <div class="flex h-screen items-center justify-center">
    <div class="text-center">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mx-auto" />
      <p class="mt-4 text-sm text-slate-500">Redirecting to Seller Dashboard...</p>
    </div>
  </div>
</template>
