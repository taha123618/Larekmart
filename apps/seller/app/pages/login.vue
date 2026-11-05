<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "~/stores/auth.store";
import { SignIn } from "@clerk/vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  layout: "auth",
  middleware: "guest",
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const email = ref("");
const password = ref("");
const isLoading = ref(false);
const errorMessage = ref("");

const redirectPath = (route.query.redirect as string) || "/dashboard";

// Quick development login for local testing
const handleDevLogin = async () => {
  isLoading.value = true;
  errorMessage.value = "";
  try {
    // Set a dev session token
    const devToken = "mock_seller_jwt_token." + btoa(JSON.stringify({
      sub: "user_seller_demo_1",
      email: email.value || "seller@larekmart.com",
      role: "seller",
      exp: Math.floor(Date.now() / 1000) + 86400 * 7,
    })) + ".signature";

    authStore.setAuth({
      userId: "user_seller_demo_1",
      token: devToken,
      user: {
        id: "user_seller_demo_1",
        email: email.value || "seller@larekmart.com",
        firstName: "Sarah",
        lastName: "Merchant",
        fullName: "Sarah Merchant",
      },
    });

    await router.push(redirectPath);
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : "Authentication failed";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="mb-6 text-center">
      <h2 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        Sign in to Seller Central
      </h2>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Access your inventory, orders, analytics, and payouts
      </p>
    </div>

    <!-- Clerk Official Component if available -->
    <div class="clerk-container flex justify-center mb-6">
      <ClientOnly>
        <SignIn
          routing="hash"
          :redirect-url="redirectPath"
        />
        <template #fallback>
          <div class="py-4">
            <LoadingSpinner size="md" label="Loading sign in..." />
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- Direct Sign In / Dev Quick Access Form -->
    <div class="relative my-6">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-slate-200 dark:border-slate-800" />
      </div>
      <div class="relative flex justify-center text-xs uppercase">
        <span class="bg-white px-2 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
          Or Quick Merchant Access
        </span>
      </div>
    </div>

    <form class="space-y-4" @submit.prevent="handleDevLogin">
      <div v-if="errorMessage" class="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
        {{ errorMessage }}
      </div>

      <div>
        <label for="email" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Email address
        </label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          placeholder="seller@larekmart.com"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      <div>
        <label for="password" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Password
        </label>
        <input
          id="password"
          v-model="password"
          type="password"
          placeholder="••••••••"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
      >
        <LoadingSpinner v-if="isLoading" size="sm" class="inline-block mr-2" />
        <span>Continue to Merchant Dashboard</span>
      </button>
    </form>
  </div>
</template>
