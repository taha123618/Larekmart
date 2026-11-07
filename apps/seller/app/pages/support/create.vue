<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
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

const form = ref({
  category: "ORDERS" as "ORDERS" | "PAYMENTS" | "CATALOG" | "ACCOUNT" | "TECHNICAL",
  priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  subject: "",
  description: "",
});

const isSubmitting = ref(false);
const errorMessage = ref("");

const handleSubmit = async () => {
  isSubmitting.value = true;
  errorMessage.value = "";

  try {
    await api.post("/api/v1/support/tickets", {
      sellerId: sellerStore.activeSellerId,
      categoryCode: form.value.category,
      category: form.value.category,
      priority: form.value.priority,
      subject: form.value.subject,
      description: form.value.description,
      source: "SELLER",
    });

    notify.success("Ticket Submitted", "Our merchant operations team will review your request.");
    await router.push("/support");
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : "Failed to submit support ticket";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <PageHeader
      title="Create Support Ticket"
      description="Submit a request directly to the LarekMart marketplace operations and merchant care department."
    >
      <template #actions>
        <NuxtLink
          to="/support"
          class="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </NuxtLink>
      </template>
    </PageHeader>

    <form class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="handleSubmit">
      <div v-if="errorMessage" class="rounded-lg bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
        {{ errorMessage }}
      </div>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Inquiry Category *
          </label>
          <select
            v-model="form.category"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="ORDERS">Orders & Fulfillment Inquiries</option>
            <option value="PAYMENTS">Payouts, Escrow & Settlements</option>
            <option value="CATALOG">Catalog Management & Categorization</option>
            <option value="ACCOUNT">Business Entity & KYB Account Changes</option>
            <option value="TECHNICAL">Technical, API & Webhook Issues</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Priority Level *
          </label>
          <select
            v-model="form.priority"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="LOW">Low — General Question</option>
            <option value="MEDIUM">Medium — Standard Escalation</option>
            <option value="HIGH">High — Revenue / Order Impacting</option>
            <option value="URGENT">Urgent — Severe Store Outage / Account Block</option>
          </select>
        </div>

        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Subject *
          </label>
          <input
            v-model="form.subject"
            type="text"
            required
            placeholder="e.g. Discrepancy in weekly payout batch reference #94821"
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Detailed Description *
          </label>
          <textarea
            v-model="form.description"
            rows="6"
            required
            placeholder="Include relevant order IDs, product SKUs, exact error descriptions, or settlement IDs..."
            class="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <NuxtLink
          to="/support"
          class="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </NuxtLink>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 focus:outline-none disabled:opacity-50"
        >
          <LoadingSpinner v-if="isSubmitting" size="sm" />
          <span>Submit Ticket</span>
        </button>
      </div>
    </form>
  </div>
</template>
