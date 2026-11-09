<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "~/stores/auth.store";
import { useSellerStore } from "~/stores/seller.store";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  layout: "auth",
  middleware: "guest",
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const sellerStore = useSellerStore();
const config = useRuntimeConfig();

const email = ref("");
const password = ref("");
const showPassword = ref(false);
const rememberMe = ref(true);
const isLoading = ref(false);
const errorMessage = ref("");

// Pre-fill email dynamically if passed in query string (e.g. from registration redirect)
if (route.query.email && typeof route.query.email === "string") {
  email.value = route.query.email.trim();
}

const redirectPath = (route.query.redirect as string) || "/dashboard";

const handleLogin = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  const submitEmail = email.value.trim();
  const submitPassword = password.value;

  if (!submitEmail) {
    errorMessage.value = "Please enter your merchant email address.";
    isLoading.value = false;
    return;
  }

  if (!submitPassword) {
    errorMessage.value = "Please enter your password.";
    isLoading.value = false;
    return;
  }

  try {
    const response = await $fetch<{
      success: boolean;
      userId: string;
      token: string;
      seller?: {
        id: string;
        vendorId: string;
        storeName: string;
        slug: string;
        status: string;
      };
      user: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
        fullName?: string;
      };
    }>("/api/auth/login", {
      method: "POST",
      body: {
        email: submitEmail,
        password: submitPassword,
        rememberMe: rememberMe.value,
      },
    });

    if (response?.success && response.token) {
      authStore.setAuth({
        userId: response.userId,
        token: response.token,
        user: response.user,
      });

      if (response.seller?.id) {
        sellerStore.setSellers([
          {
            id: response.seller.id,
            vendorId: response.seller.vendorId,
            primaryUserId: response.userId,
            status: response.seller.status as any,
            storeName: response.seller.storeName,
            slug: response.seller.slug,
            store: {
              id: `store_${response.seller.id}`,
              name: response.seller.storeName,
              slug: response.seller.slug,
              status: response.seller.status,
            },
          } as any,
        ]);
        sellerStore.setActiveSeller(response.seller.id);
      }

      // Dynamically load active merchant stores into Pinia
      try {
        await sellerStore.fetchSellers();
      } catch {
        // Non-blocking fallback
      }

      await router.push(redirectPath);
    } else {
      errorMessage.value =
        "Authentication was not successful. Please verify credentials.";
    }
  } catch (err: unknown) {
    const fetchErr = err as {
      data?: { statusMessage?: string; message?: string };
      message?: string;
    };
    errorMessage.value =
      fetchErr?.data?.statusMessage ||
      fetchErr?.data?.message ||
      fetchErr?.message ||
      "Failed to sign in. Please check your credentials.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="mb-6 text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
        <UIcon name="i-heroicons-building-storefront" class="h-6 w-6" />
      </div>
      <h2 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        Sign in to Seller Central
      </h2>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Manage inventory, orders, analytics, and payouts
      </p>
    </div>

    <!-- Error Alert -->
    <div
      v-if="errorMessage"
      class="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
    >
      <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 shrink-0 mt-0.5" />
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Direct Email & Password Login Form -->
    <form class="space-y-4" @submit.prevent="handleLogin">
      <div>
        <label for="email" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Merchant Email Address
        </label>
        <div class="relative mt-1">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <UIcon name="i-heroicons-envelope" class="h-4 w-4" />
          </div>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="seller@larekmart.com"
            class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
          />
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label for="password" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Password
          </label>
          <span class="text-[11px] text-slate-400">
            Registered during onboarding
          </span>
        </div>
        <div class="relative mt-1">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <UIcon name="i-heroicons-lock-closed" class="h-4 w-4" />
          </div>
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            autocomplete="current-password"
            placeholder="••••••••••••"
            class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm text-slate-900 placeholder-slate-400 transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            @click="showPassword = !showPassword"
          >
            <UIcon :name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between pt-1">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="rememberMe"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800"
          />
          <span class="text-xs text-slate-600 dark:text-slate-400">Remember for 7 days</span>
        </label>
      </div>

      <button
        type="submit"
        :disabled="isLoading"
        class="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
      >
        <LoadingSpinner v-if="isLoading" size="sm" />
        <span>{{ isLoading ? "Signing in..." : "Sign In to Seller Central" }}</span>
        <UIcon v-if="!isLoading" name="i-heroicons-arrow-right" class="h-4 w-4" />
      </button>
    </form>

    <!-- Onboarding / Registration Link -->
    <div class="mt-6 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
      <p class="text-xs text-slate-500 dark:text-slate-400">
        New to LarekMart?
        <NuxtLink
          to="/onboarding"
          class="font-semibold text-primary-600 hover:underline dark:text-primary-400 ml-1"
        >
          Become a Seller &rarr;
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
