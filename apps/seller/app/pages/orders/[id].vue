<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useApi } from "~/composables/useApi";
import { useNotifications } from "~/composables/useNotifications";
import type { Order } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

const route = useRoute();
const api = useApi();
const notify = useNotifications();

const orderId = route.params.id as string;
const order = ref<Order | null>(null);
const isLoading = ref(true);
const isUpdating = ref(false);

const fetchOrder = async () => {
  isLoading.value = true;
  try {
    const data = await api.get<Order>(`/api/v1/orders/${orderId}`);
    order.value = data;
  } catch (err: unknown) {
    order.value = null;
    const msg = (err as { message?: string })?.message || "Could not load order details.";
    notify.error("Order Not Found", msg);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void fetchOrder();
});

const updateOrderStatus = async (newStatus: Order["status"]) => {
  isUpdating.value = true;
  try {
    await api.patch(`/api/v1/orders/${orderId}`, { status: newStatus });
    if (order.value) {
      order.value.status = newStatus;
    }
    notify.success("Order Updated", `Order status updated to ${newStatus}`);
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || "Failed to update order status.";
    notify.error("Update Failed", msg);
  } finally {
    isUpdating.value = false;
  }
};
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <PageHeader
      :title="`Order #${order?.orderNumber || orderId.slice(0, 8)}`"
      :description="`Placed on ${order?.createdAt ? new Date(order.createdAt).toLocaleString() : 'Recent'}`"
    >
      <template #actions>
        <NuxtLink
          to="/orders"
          class="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Back to Orders
        </NuxtLink>
      </template>
    </PageHeader>

    <div v-if="isLoading" class="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
      <LoadingSpinner size="lg" label="Loading order details..." />
    </div>

    <div v-else-if="order" class="space-y-6">
      <!-- Status Card -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center gap-3">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Status:</span>
          <StatusBadge :status="order.status" size="lg" />
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="order.status === 'CONFIRMED'"
            type="button"
            :disabled="isUpdating"
            class="rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            @click="updateOrderStatus('PROCESSING')"
          >
            Mark as Processing
          </button>
          <button
            v-if="order.status === 'PROCESSING'"
            type="button"
            :disabled="isUpdating"
            class="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            @click="updateOrderStatus('SHIPPED')"
          >
            Mark as Shipped
          </button>
          <button
            v-if="order.status === 'SHIPPED'"
            type="button"
            :disabled="isUpdating"
            class="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
            @click="updateOrderStatus('DELIVERED')"
          >
            Mark as Delivered
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Order Items Breakdown -->
        <div class="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Items in Order
          </h3>

          <div class="divide-y divide-slate-100 dark:divide-slate-800">
            <div
              v-for="item in order.items"
              :key="item.id"
              class="py-3 flex items-center justify-between text-xs"
            >
              <div>
                <p class="font-semibold text-slate-900 dark:text-white">{{ item.productName }}</p>
                <p class="text-[10px] text-slate-500 font-mono">SKU: {{ item.sku }} • Qty: {{ item.quantity }}</p>
              </div>
              <div class="text-right">
                <p class="font-semibold text-slate-900 dark:text-white">${{ Number(item.subtotal).toFixed(2) }}</p>
                <p class="text-[10px] text-slate-500">${{ Number(item.unitPrice).toFixed(2) }} each</p>
              </div>
            </div>
          </div>

          <div class="mt-4 border-t border-slate-200 pt-4 flex justify-between font-bold text-sm text-slate-900 dark:text-white dark:border-slate-800">
            <span>Order Total</span>
            <span>${{ Number(order.totalAmount).toFixed(2) }} {{ order.currency }}</span>
          </div>
        </div>

        <!-- Customer & Shipping Summary -->
        <div class="space-y-6">
          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-3">
              Customer Details
            </h3>
            <div class="text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
              <p class="font-semibold text-slate-900 dark:text-white">{{ order.customerName }}</p>
              <p>{{ order.customerEmail }}</p>
              <p class="text-[10px] text-slate-400 font-mono">ID: {{ order.customerId }}</p>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-3">
              Shipping Destination
            </h3>
            <div v-if="order.shippingAddress" class="text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <p class="font-semibold text-slate-900 dark:text-white">{{ order.shippingAddress.name }}</p>
              <p>{{ order.shippingAddress.line1 }}</p>
              <p v-if="order.shippingAddress.line2">{{ order.shippingAddress.line2 }}</p>
              <p>{{ order.shippingAddress.city }}, {{ order.shippingAddress.state }} {{ order.shippingAddress.postalCode }}</p>
              <p>{{ order.shippingAddress.country }}</p>
            </div>
            <p v-else class="text-xs text-slate-400">No shipping destination details provided.</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
      <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Order not found</p>
      <p class="mt-1 text-xs text-slate-500">The requested order could not be located or you do not have permission to view it.</p>
      <NuxtLink
        to="/orders"
        class="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
      >
        Return to Orders
      </NuxtLink>
    </div>
  </div>
</template>
