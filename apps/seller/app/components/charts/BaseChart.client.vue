<script setup lang="ts">
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart, BarChart, PieChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
} from "echarts/components";
import VChart from "vue-echarts";

// Register ECharts modules
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
]);

withDefaults(
  defineProps<{
    option: Record<string, any>;
    autoresize?: boolean;
    loading?: boolean;
    height?: string;
  }>(),
  {
    autoresize: true,
    loading: false,
    height: "350px",
  },
);
</script>

<template>
  <div :style="{ height }" class="w-full relative">
    <VChart
      :option="option"
      :autoresize="autoresize"
      :loading="loading"
      class="w-full h-full"
    />
  </div>
</template>
