import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { cn } from 'cnfast';

interface MetricGaugeProps {
  title: string;
  unit: string;
  capacity: number;
  allocatable: number;
  usage: number;
  requests?: number;
  limits?: number;
  colors: {
    usage: string;
    requests?: string;
    limits?: string;
    bg: string;
  };
}

export const MetricGauge: React.FC<MetricGaugeProps> = ({
  title,
  unit,
  capacity,
  allocatable,
  usage,
  requests = 0,
  limits = 0,
  colors
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isWide, setIsWide] = useState(true);

  // 1. Observe actual card container width for layout responsiveness
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // If the card is wider than 340px, align details on the right.
        // Otherwise, stack them below the gauge.
        setIsWide(entry.contentRect.width > 340);
      }
    });

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  // 2. Initialize ECharts instance exactly once on mount
  useEffect(() => {
    if (!chartRef.current) return;

    const myChart = echarts.init(chartRef.current);
    chartInstanceRef.current = myChart;

    const handleResize = () => {
      myChart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      myChart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  // 3. Perform delta updates when values change (reactively fetching computed styles)
  useEffect(() => {
    if (!chartInstanceRef.current || !chartRef.current) return;

    // Dynamically retrieve CSS colors from the DOM for light/dark mode compliance
    const computedStyles = window.getComputedStyle(chartRef.current);
    const textColor = computedStyles.getPropertyValue('--color-text-base').trim() || '#ffffff';
    const trackColor = computedStyles.getPropertyValue('--color-surface-3').trim() || '#27272a';

    const getRingData = (val: number, max: number, color: string) => {
      return [
        {
          value: val,
          itemStyle: {
            color: color,
            borderRadius: 10
          }
        },
        {
          value: Math.max(0, max - val),
          itemStyle: {
            color: trackColor
          },
          label: { show: false },
          labelLine: { show: false }
        }
      ];
    };

    const series: echarts.PieSeriesOption[] = [];

    if (colors.limits && colors.requests) {
      // CPU or Memory: Concentric Rings
      // 1. Usage (Outer)
      series.push({
        type: 'pie',
        radius: ['82%', '92%'],
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        avoidLabelOverlap: false,
        label: { show: false },
        silent: true,
        data: getRingData(usage, capacity, colors.usage)
      });
      // 2. Requests (Middle)
      series.push({
        type: 'pie',
        radius: ['64%', '74%'],
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        avoidLabelOverlap: false,
        label: { show: false },
        silent: true,
        data: getRingData(requests, capacity, colors.requests)
      });
      // 3. Limits (Inner)
      series.push({
        type: 'pie',
        radius: ['46%', '56%'],
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        avoidLabelOverlap: false,
        label: { show: false },
        silent: true,
        data: getRingData(limits, capacity, colors.limits)
      });
    } else {
      // Pods: Single Ring
      series.push({
        type: 'pie',
        radius: ['70%', '85%'],
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        avoidLabelOverlap: false,
        label: { show: false },
        silent: true,
        data: getRingData(usage, capacity, colors.usage)
      });
    }

    const option: echarts.EChartsOption = {
      title: {
        text: `${usage.toFixed(1)}${unit}`,
        left: 'center',
        top: 'middle', // Align text exactly in the center of the ring
        textStyle: {
          color: textColor,
          fontSize: 14,
          fontWeight: 'bold',
          fontFamily: 'monospace'
        }
      },
      tooltip: { show: false },
      series: series
    };

    chartInstanceRef.current.setOption(option);
  }, [usage, requests, limits, capacity, colors, title, unit]);

  const hasConcentric = !!colors.limits && !!colors.requests;

  return (
    <div
      ref={containerRef}
      className={cn(
        'p-2 flex flex-col gap-3 select-none shrink-0 min-w-0 overflow-hidden transition-[height] duration-200',
        isWide ? 'h-[180px]' : 'h-[280px]'
      )}
    >
      {/* 1. Big prominent title at the top left of the card */}
      <h3 className="text-xs font-bold text-text-base uppercase tracking-wider font-sans pb-1.5 border-b border-border/40 truncate shrink-0">
        {title}
      </h3>

      {/* 2. Responsive container: side-by-side or stacked depending on layout space */}
      <div
        className={cn('flex items-center gap-4 w-full min-w-0', isWide ? 'flex-row' : 'flex-col')}
      >
        {/* Circle Gauge */}
        <div className="flex justify-center shrink-0">
          <div ref={chartRef} className="size-32 relative" />
        </div>

        {/* Details & Legend list */}
        <div
          className={cn(
            'flex flex-col gap-1.5 text-[11px] leading-tight min-w-0',
            isWide ? 'flex-1 w-auto max-w-[240px]' : 'w-full max-w-none'
          )}
        >
          {/* Usage */}
          <div className="flex justify-between items-center gap-2 min-w-0 w-full">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="size-2 rounded-sm shrink-0"
                style={{ backgroundColor: colors.usage }}
              />
              <span className="text-zinc-400 font-medium truncate">Live Usage</span>
            </div>
            <span className="font-mono text-text-base font-semibold shrink-0">
              {usage.toFixed(2)} {unit}
            </span>
          </div>

          {hasConcentric && (
            <>
              {/* Requests */}
              <div className="flex justify-between items-center gap-2 min-w-0 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="size-2 rounded-sm shrink-0"
                    style={{ backgroundColor: colors.requests }}
                  />
                  <span className="text-zinc-400 font-medium truncate">Requests</span>
                </div>
                <span className="font-mono text-text-base font-semibold shrink-0">
                  {requests.toFixed(2)} {unit}
                </span>
              </div>

              {/* Limits */}
              <div className="flex justify-between items-center gap-2 min-w-0 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="size-2 rounded-sm shrink-0"
                    style={{ backgroundColor: colors.limits }}
                  />
                  <span className="text-zinc-400 font-medium truncate">Limits</span>
                </div>
                <span className="font-mono text-text-base font-semibold shrink-0">
                  {limits.toFixed(2)} {unit}
                </span>
              </div>
            </>
          )}

          <hr className="border-border/40 my-0.5" />

          {/* Allocatable Capacity */}
          <div className="flex justify-between items-center gap-2 min-w-0 w-full">
            <span className="text-zinc-555 font-medium pl-3 truncate">Allocatable</span>
            <span className="font-mono text-text-dim shrink-0">
              {allocatable.toFixed(2)} {unit}
            </span>
          </div>

          {/* Total Capacity */}
          <div className="flex justify-between items-center gap-2 min-w-0 w-full">
            <span className="text-zinc-555 font-medium pl-3 truncate">Capacity</span>
            <span className="font-mono text-text-dim shrink-0">
              {capacity.toFixed(2)} {unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
