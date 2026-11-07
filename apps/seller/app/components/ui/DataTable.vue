<script setup lang="ts" generic="TData">
import {
  useVueTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  FlexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/vue-table";
import { ref, computed } from "vue";
import LoadingSpinner from "./LoadingSpinner.vue";
import EmptyState from "./EmptyState.vue";

interface Props {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  loading?: boolean;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  searchPlaceholder: "Search records...",
  emptyTitle: "No records found",
  emptyDescription: "No items match your criteria or none have been created yet.",
});

const sorting = ref<SortingState>([]);
const globalFilter = ref("");
const pageSize = ref(10);

const table = useVueTable({
  get data() {
    return props.data;
  },
  get columns() {
    return props.columns;
  },
  state: {
    get sorting() {
      return sorting.value;
    },
    get globalFilter() {
      return globalFilter.value;
    },
  },
  onSortingChange: (updaterOrValue) => {
    sorting.value =
      typeof updaterOrValue === "function"
        ? updaterOrValue(sorting.value)
        : updaterOrValue;
  },
  onGlobalFilterChange: (updaterOrValue) => {
    globalFilter.value =
      typeof updaterOrValue === "function"
        ? updaterOrValue(globalFilter.value)
        : updaterOrValue;
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  initialState: {
    pagination: {
      pageSize: pageSize.value,
    },
  },
});

const rows = computed(() => table.getRowModel().rows);
const pageIndex = computed(() => table.getState().pagination.pageIndex);
const pageCount = computed(() => table.getPageCount());
const totalRows = computed(() => props.data.length);
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="relative max-w-sm flex-1">
        <input
          v-model="globalFilter"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
        />
      </div>

      <div class="flex items-center gap-2">
        <slot name="toolbar" />
      </div>
    </div>

    <!-- Table Container -->
    <div
      class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead
            class="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
          >
            <tr
              v-for="headerGroup in table.getHeaderGroups()"
              :key="headerGroup.id"
            >
              <th
                v-for="header in headerGroup.headers"
                :key="header.id"
                class="px-6 py-3.5"
                :class="{
                  'cursor-pointer select-none': header.column.getCanSort(),
                }"
                @click="header.column.getToggleSortingHandler()?.($event)"
              >
                <div class="flex items-center gap-1.5">
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <span v-if="header.column.getIsSorted() === 'asc'">↑</span>
                  <span v-else-if="header.column.getIsSorted() === 'desc'">↓</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
            <!-- Loading State -->
            <tr v-if="loading">
              <td
                :colspan="columns.length"
                class="px-6 py-12 text-center"
              >
                <LoadingSpinner size="lg" label="Loading data..." />
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-else-if="rows.length === 0">
              <td
                :colspan="columns.length"
                class="px-6 py-12 text-center"
              >
                <EmptyState
                  :title="emptyTitle"
                  :description="emptyDescription"
                />
              </td>
            </tr>

            <!-- Data Rows -->
            <tr
              v-for="row in rows"
              v-else
              :key="row.id"
              class="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="px-6 py-4"
              >
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        class="flex flex-col items-center justify-between gap-4 border-t border-slate-200 px-6 py-3 sm:flex-row dark:border-slate-800"
      >
        <span class="text-xs text-slate-500 dark:text-slate-400">
          Showing
          <span class="font-medium text-slate-900 dark:text-white">
            {{ rows.length > 0 ? pageIndex * pageSize + 1 : 0 }}
          </span>
          to
          <span class="font-medium text-slate-900 dark:text-white">
            {{ Math.min((pageIndex + 1) * pageSize, totalRows) }}
          </span>
          of
          <span class="font-medium text-slate-900 dark:text-white">
            {{ totalRows }}
          </span>
          results
        </span>

        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="!table.getCanPreviousPage()"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            @click="table.previousPage()"
          >
            Previous
          </button>
          <span class="text-xs text-slate-500 dark:text-slate-400">
            Page {{ pageIndex + 1 }} of {{ Math.max(pageCount, 1) }}
          </span>
          <button
            type="button"
            :disabled="!table.getCanNextPage()"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            @click="table.nextPage()"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
