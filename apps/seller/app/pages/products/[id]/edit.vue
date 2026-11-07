<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApi } from "~/composables/useApi";
import { useNotifications } from "~/composables/useNotifications";
import type { Product } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

const route = useRoute();
const router = useRouter();
const api = useApi();
const notify = useNotifications();

const productId = route.params.id as string;
const isLoading = ref(true);
const isSaving = ref(false);

const form = ref({
  name: "",
  sku: "",
  price: 0,
  compareAtPrice: null as number | null,
  stockQuantity: 0,
  category: "",
  description: "",
  status: "ACTIVE" as "ACTIVE" | "DRAFT" | "ARCHIVED" | "OUT_OF_STOCK",
});

onMounted(async () => {
  try {
    const data = await api.get<Product>(`/api/v1/products/${productId}`).catch(() => null);
    if (data) {
      form.value = {
        name: data.name,
        sku: data.sku,
        price: data.price,
        compareAtPrice: data.compareAtPrice || null,
        stockQuantity: data.stockQuantity,
        category: data.category,
        description: data.description,
        status: data.status || "ACTIVE",
      };
    }
  } catch (err: unknown) {
    notify.error("Error", "Failed to load product details");
  } finally {
    isLoading.value = false;
  }
});

const handleSave = async () => {
  isSaving.value = true;
  try {
    await api.patch(`/api/v1/products/${productId}`, {
      name: form.value.name,
      price: Number(form.value.price),
      compareAtPrice: form.value.compareAtPrice ? Number(form.value.compareAtPrice) : null,
      stockQuantity: Number(form.value.stockQuantity),
      category: form.value.category,
      description: form.value.description,
      status: form.value.status,
    });
    notify.success("Updated", "Product changes have been saved.");
    await router.push("/products");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save product";
    notify.error("Update Error", msg);
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <PageHeader
      :title="`Edit Product: ${form.name || productId}`"
      description="Update pricing, stock levels, product status, and descriptive specifications."
    >
      <template #actions>
        <NuxtLink
          to="/products"
          class="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Back to List
        </NuxtLink>
      </template>
    </PageHeader>

    <div v-if="isLoading" class="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
      <LoadingSpinner size="lg" label="Loading product..." />
    </div>

    <form v-else class="space-y-6" @submit.prevent="handleSave">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 dark:border-slate-800 dark:bg-slate-900">
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Product Title
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              SKU (Identifier)
            </label>
            <input
              v-model="form.sku"
              type="text"
              disabled
              class="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Price ($)
            </label>
            <input
              v-model.number="form.price"
              type="number"
              step="0.01"
              required
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Stock Quantity
            </label>
            <input
              v-model.number="form.stockQuantity"
              type="number"
              min="0"
              required
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Status
            </label>
            <select
              v-model="form.status"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAFT">DRAFT</option>
              <option value="ARCHIVED">ARCHIVED</option>
              <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Category
            </label>
            <input
              v-model="form.category"
              type="text"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              v-model="form.description"
              rows="4"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3">
        <NuxtLink
          to="/products"
          class="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </NuxtLink>

        <button
          type="submit"
          :disabled="isSaving"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 disabled:opacity-50"
        >
          <LoadingSpinner v-if="isSaving" size="sm" />
          <span>Save Changes</span>
        </button>
      </div>
    </form>
  </div>
</template>
