<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { z } from "zod";
import { useApi } from "~/composables/useApi";
import { useSellerStore } from "~/stores/seller.store";
import { useNotifications } from "~/composables/useNotifications";
import PageHeader from "~/components/ui/PageHeader.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

const router = useRouter();
const api = useApi();
const sellerStore = useSellerStore();
const notify = useNotifications();

const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters"),
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  price: z.number().positive("Price must be greater than 0"),
  compareAtPrice: z.number().optional().nullable(),
  stockQuantity: z.number().int().min(0, "Stock cannot be negative"),
  category: z.string().min(1, "Please select or enter a category"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type ProductFormData = z.infer<typeof productSchema>;

const form = ref<ProductFormData>({
  name: "",
  slug: "",
  sku: "",
  price: 0,
  compareAtPrice: null,
  stockQuantity: 10,
  category: "Electronics",
  description: "",
  imageUrl: "",
});

const errors = ref<Record<string, string>>({});
const isSubmitting = ref(false);

const handleNameChange = () => {
  if (!form.value.slug) {
    form.value.slug = form.value.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
};

const handleSubmit = async () => {
  errors.value = {};
  const parsed = productSchema.safeParse(form.value);

  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      if (issue.path[0]) {
        errors.value[String(issue.path[0])] = issue.message;
      }
    });
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      sellerId: sellerStore.activeSellerId,
      name: form.value.name,
      slug: form.value.slug,
      sku: form.value.sku,
      price: Number(form.value.price),
      compareAtPrice: form.value.compareAtPrice ? Number(form.value.compareAtPrice) : null,
      stockQuantity: Number(form.value.stockQuantity),
      category: form.value.category,
      description: form.value.description,
      images: form.value.imageUrl ? [form.value.imageUrl] : [],
      currency: sellerStore.activeSeller?.primaryCurrency || "USD",
      status: "ACTIVE",
    };

    await api.post("/api/v1/products", payload);
    notify.success("Product Created", "Your new product is live in the catalog.");
    await router.push("/products");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create product";
    notify.error("Creation Failed", msg);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <PageHeader
      title="Create New Product"
      description="Add a new physical or digital product to your marketplace catalog."
    >
      <template #actions>
        <NuxtLink
          to="/products"
          class="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </NuxtLink>
      </template>
    </PageHeader>

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">Basic Information</h3>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Product Title *
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="e.g. Wireless Noise-Cancelling Headphones"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              @blur="handleNameChange"
            />
            <p v-if="errors.name" class="mt-1 text-[11px] text-rose-500">{{ errors.name }}</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              URL Slug *
            </label>
            <input
              v-model="form.slug"
              type="text"
              required
              placeholder="wireless-noise-cancelling-headphones"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p v-if="errors.slug" class="mt-1 text-[11px] text-rose-500">{{ errors.slug }}</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              SKU (Stock Keeping Unit) *
            </label>
            <input
              v-model="form.sku"
              type="text"
              required
              placeholder="WNC-HP-001"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p v-if="errors.sku" class="mt-1 text-[11px] text-rose-500">{{ errors.sku }}</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Category *
            </label>
            <input
              v-model="form.category"
              type="text"
              required
              placeholder="Electronics"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p v-if="errors.category" class="mt-1 text-[11px] text-rose-500">{{ errors.category }}</p>
          </div>

          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Description *
            </label>
            <textarea
              v-model="form.description"
              rows="4"
              required
              placeholder="Provide a comprehensive overview of features, specifications, and materials..."
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p v-if="errors.description" class="mt-1 text-[11px] text-rose-500">{{ errors.description }}</p>
          </div>
        </div>
      </div>

      <!-- Pricing & Inventory Section -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">Pricing & Inventory</h3>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Retail Price ($) *
            </label>
            <input
              v-model.number="form.price"
              type="number"
              step="0.01"
              min="0"
              required
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p v-if="errors.price" class="mt-1 text-[11px] text-rose-500">{{ errors.price }}</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Compare At Price ($)
            </label>
            <input
              v-model.number="form.compareAtPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="Optional strike-through"
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Available Units *
            </label>
            <input
              v-model.number="form.stockQuantity"
              type="number"
              min="0"
              required
              class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p v-if="errors.stockQuantity" class="mt-1 text-[11px] text-rose-500">{{ errors.stockQuantity }}</p>
          </div>
        </div>
      </div>

      <!-- Media Section -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">Product Media</h3>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Image URL
          </label>
          <input
            v-model="form.imageUrl"
            type="url"
            placeholder="https://images.unsplash.com/photo-example"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <p v-if="errors.imageUrl" class="mt-1 text-[11px] text-rose-500">{{ errors.imageUrl }}</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-4">
        <NuxtLink
          to="/products"
          class="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </NuxtLink>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <LoadingSpinner v-if="isSubmitting" size="sm" />
          <span>Publish Product</span>
        </button>
      </div>
    </form>
  </div>
</template>
