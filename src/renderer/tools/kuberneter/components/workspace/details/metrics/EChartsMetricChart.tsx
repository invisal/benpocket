import type React from 'react';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export interface ChartSeries {
  name: string;
  color: string;
  data: number[];
}

export interface EChartsMetricChartProps {
  title?: string;
  timeLabels: string[];
  series: ChartSeries[];
  unit?: string;
  height?: number;
  showLegend?: boolean;
}

const EChartsMetricChartLazy = lazy(() => import('./EChartsMetricChartImpl'));

export const EChartsMetricChart: React.FC<EChartsMetricChartProps> = (props) => {
  const height = props.height ?? 160;
  return (
    <Suspense
      fallback={
        <div
          style={{ width: '100%', height }}
          className="flex items-center justify-center text-xs text-muted-foreground font-mono gap-2 bg-surface-2/30 rounded"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          <span>Loading chart...</span>
        </div>
      }
    >
      <EChartsMetricChartLazy {...props} />
    </Suspense>
  );
};
