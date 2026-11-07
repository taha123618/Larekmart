<script setup lang="ts">
import { ref, onMounted, computed, h } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { useApi } from "~/composables/useApi";
import { useSellerStore } from "~/stores/seller.store";
import { useNotifications } from "~/composables/useNotifications";
import type { SellerStaff, StaffRole } from "~/types";
import PageHeader from "~/components/ui/PageHeader.vue";
import DataTable from "~/components/ui/DataTable.vue";
import StatusBadge from "~/components/ui/StatusBadge.vue";
import LoadingSpinner from "~/components/ui/LoadingSpinner.vue";

definePageMeta({
  middleware: "seller-access",
});

const api = useApi();
const sellerStore = useSellerStore();
const notify = useNotifications();

const sellerId = computed(() => sellerStore.activeSellerId);

const staffMembers = ref<SellerStaff[]>([]);
const isLoading = ref(true);
const isInviting = ref(false);
const showInviteModal = ref(false);

const inviteForm = ref({
  email: "",
  name: "",
  role: "MANAGER" as StaffRole,
});

const fetchStaff = async () => {
  if (!sellerId.value) return;
  isLoading.value = true;
  try {
    const list = await api.get<SellerStaff[]>(`/api/v1/sellers/${sellerId.value}/staff`);
    staffMembers.value = Array.isArray(list) ? list : [];
  } catch {
    staffMembers.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  void fetchStaff();
});

const handleInvite = async () => {
  if (!sellerId.value) return;
  isInviting.value = true;
  try {
    await api.post(`/api/v1/sellers/${sellerId.value}/staff`, inviteForm.value);
    notify.success("Invitation Sent", `Invited ${inviteForm.value.email} to the store team.`);
    showInviteModal.value = false;
    inviteForm.value = { email: "", name: "", role: "MANAGER" };
    void fetchStaff();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to invite staff member";
    notify.error("Error", msg);
  } finally {
    isInviting.value = false;
  }
};

const columns: ColumnDef<SellerStaff, unknown>[] = [
  {
    accessorKey: "email",
    header: "Team Member",
    cell: ({ row }) => {
      const s = row.original;
      return h("div", {}, [
        h("p", { class: "font-semibold text-xs text-slate-900 dark:text-white" }, s.name || s.email),
        h("p", { class: "text-[10px] text-slate-500" }, s.email),
      ]);
    },
  },
  {
    accessorKey: "role",
    header: "Assigned Role",
    cell: ({ row }) =>
      h("span", { class: "font-mono font-medium text-xs text-slate-700 dark:text-slate-300" }, row.original.role),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => h(StatusBadge, { status: row.original.status || "ACTIVE", size: "sm" }),
  },
  {
    accessorKey: "joinedAt",
    header: "Date Added",
    cell: ({ row }) => {
      const d = row.original.joinedAt ? new Date(row.original.joinedAt).toLocaleDateString() : "-";
      return h("span", { class: "text-xs text-slate-500" }, d);
    },
  },
];
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <PageHeader
      title="Store Team & Staff Permissions"
      description="Collaborate with team members, delegate catalog and order operations, and manage role assignments."
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700"
          @click="showInviteModal = true"
        >
          <UIcon name="i-heroicons-user-plus" class="h-4 w-4" />
          <span>Invite Team Member</span>
        </button>
      </template>
    </PageHeader>

    <!-- Settings Subnav Tabs -->
    <div class="flex border-b border-slate-200 dark:border-slate-800">
      <NuxtLink
        to="/settings"
        class="border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        General Storefront
      </NuxtLink>
      <NuxtLink
        to="/settings/staff"
        class="border-b-2 border-primary-600 px-4 py-2.5 text-xs font-semibold text-primary-600 dark:text-primary-400"
      >
        Team & Staff Permissions
      </NuxtLink>
      <NuxtLink
        to="/settings/policies"
        class="border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        Store Policies & Terms
      </NuxtLink>
    </div>

    <!-- Staff Table -->
    <DataTable
      :data="staffMembers"
      :columns="columns"
      :loading="isLoading"
      search-placeholder="Search by name, email..."
      empty-title="No staff members invited"
      empty-description="As store owner, you can invite managers, fulfillment operators, and support specialists to manage daily merchant workflows."
    />

    <!-- Invite Staff Modal -->
    <div
      v-if="showInviteModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Invite Staff Member
          </h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="showInviteModal = false"
          >
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>

        <form class="mt-4 space-y-4" @submit.prevent="handleInvite">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Staff Full Name
            </label>
            <input
              v-model="inviteForm.name"
              type="text"
              required
              placeholder="e.g. Jordan Miller"
              class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email Address *
            </label>
            <input
              v-model="inviteForm.email"
              type="email"
              required
              placeholder="jordan@yourcompany.com"
              class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Operational Role *
            </label>
            <select
              v-model="inviteForm.role"
              class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="MANAGER">MANAGER (All store capabilities except ownership)</option>
              <option value="CATALOG_SPECIALIST">CATALOG_SPECIALIST (Product & inventory edits)</option>
              <option value="FULFILLMENT_OPERATOR">FULFILLMENT_OPERATOR (Orders & shipping management)</option>
              <option value="CUSTOMER_SUPPORT">CUSTOMER_SUPPORT (Buyer chat & ticket resolution)</option>
            </select>
          </div>

          <div class="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              @click="showInviteModal = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isInviting"
              class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <LoadingSpinner v-if="isInviting" size="sm" />
              <span>Send Invitation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
