<script setup lang="ts">
import { ref } from "vue";
import { parseAndValidateCsv, type ValidationRule, type ParseResult } from "~/utils/csv-parser";
import { exportToCsv } from "~/utils/export";

const props = defineProps<{
  isOpen: boolean;
  title: string;
  description: string;
  templateFilename: string;
  templateHeaders: Array<{ key: string; label: string }>;
  sampleRows: Array<Record<string, any>>;
  rules: ValidationRule<any>[];
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "import", data: any[]): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFileName = ref<string | null>(null);
const parseResult = ref<ParseResult<any> | null>(null);
const isProcessingFile = ref(false);

const handleDownloadTemplate = () => {
  exportToCsv(props.templateFilename, props.templateHeaders, props.sampleRows);
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  selectedFileName.value = file.name;
  isProcessingFile.value = true;

  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target?.result as string;
    if (text) {
      parseResult.value = parseAndValidateCsv(text, props.rules);
    }
    isProcessingFile.value = false;
  };
  reader.onerror = () => {
    isProcessingFile.value = false;
  };
  reader.readAsText(file);
};

const handleClose = () => {
  selectedFileName.value = null;
  parseResult.value = null;
  emit("close");
};

const handleConfirmImport = () => {
  if (!parseResult.value || parseResult.value.validRows === 0) return;
  emit("import", parseResult.value.data);
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
  >
    <div
      class="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-arrow-up-tray" class="h-5 w-5 text-primary-600" />
            {{ title }}
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            {{ description }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          @click="handleClose"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="py-5 space-y-5 max-h-[70vh] overflow-y-auto">
        <!-- Download Template CTA -->
        <div
          class="flex items-center justify-between p-3.5 rounded-xl border border-primary-500/20 bg-primary-50/50 dark:border-primary-500/30 dark:bg-primary-950/20 text-xs"
        >
          <div class="flex items-center gap-2 text-primary-900 dark:text-primary-300">
            <UIcon name="i-heroicons-document-text" class="h-5 w-5 text-primary-600 shrink-0" />
            <span>Need the official format? Download our formatted sample CSV template.</span>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-primary-600 font-semibold text-white hover:bg-primary-700 transition shrink-0"
            @click="handleDownloadTemplate"
          >
            Download CSV Template
          </button>
        </div>

        <!-- File Upload Area -->
        <div
          class="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-primary-500 transition cursor-pointer"
          @click="fileInput?.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".csv,text/csv"
            class="hidden"
            @change="handleFileChange"
          />
          <UIcon name="i-heroicons-cloud-arrow-up" class="h-10 w-10 text-slate-400 mx-auto mb-2" />
          <p class="text-xs font-semibold text-slate-900 dark:text-white">
            <span v-if="selectedFileName">{{ selectedFileName }}</span>
            <span v-else>Click to select or drag and drop your RFC 4180 CSV file</span>
          </p>
          <p class="text-[11px] text-slate-500 mt-1">
            Max 5,000 rows per file. Supports UTF-8 and comma-delimited columns.
          </p>
        </div>

        <!-- Processing State -->
        <div v-if="isProcessingFile" class="py-4 text-center">
          <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-primary-600 mx-auto" />
          <p class="text-xs text-slate-500 mt-2">Parsing and validating CSV schema...</p>
        </div>

        <!-- Validation Results Summary -->
        <div v-if="parseResult" class="space-y-4">
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span class="text-[10px] text-slate-500 uppercase font-semibold">Total Rows</span>
              <p class="text-lg font-bold text-slate-900 dark:text-white font-mono">{{ parseResult.totalRows }}</p>
            </div>
            <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20">
              <span class="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Valid Rows</span>
              <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">{{ parseResult.validRows }}</p>
            </div>
            <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20">
              <span class="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">Schema Errors</span>
              <p class="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">{{ parseResult.errors.length }}</p>
            </div>
          </div>

          <!-- Error Log if any -->
          <div
            v-if="parseResult.errors.length > 0"
            class="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-800 dark:text-rose-300 max-h-40 overflow-y-auto space-y-1.5"
          >
            <p class="font-bold flex items-center gap-1.5">
              <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 text-rose-500 shrink-0" />
              <span>Row-Level Errors Detected (will be skipped during import):</span>
            </p>
            <ul class="list-disc pl-5 space-y-1 text-[11px]">
              <li v-for="(err, idx) in parseResult.errors.slice(0, 10)" :key="idx">
                <span class="font-bold">Row {{ err.row }}:</span> {{ err.message }}
              </li>
              <li v-if="parseResult.errors.length > 10" class="italic text-rose-700 dark:text-rose-400">
                + {{ parseResult.errors.length - 10 }} more errors...
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          @click="handleClose"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="!parseResult || parseResult.validRows === 0 || isSubmitting"
          class="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-xs font-bold text-white shadow-xs transition"
          @click="handleConfirmImport"
        >
          <UIcon v-if="isSubmitting" name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
          <span>Confirm & Import {{ parseResult?.validRows ?? 0 }} Records</span>
        </button>
      </div>
    </div>
  </div>
</template>
