// Tree-shaken echarts build: only the chart types, components, and renderer
// actually used by the kuberneter tool are registered here.
import * as echarts from 'echarts/core';
import { LineChart, PieChart, type LineSeriesOption, type PieSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  type GridComponentOption,
  TitleComponent,
  type TitleComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
  LegendComponent,
  type LegendComponentOption
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  PieChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer
]);

export type EChartsOption = echarts.ComposeOption<
  | LineSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TitleComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>;

export type { PieSeriesOption };
export * from 'echarts/core';
