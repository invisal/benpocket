import type React from 'react';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { cn } from 'cnfast';

interface HistoryPoint {
  time: string;
  cpu: number;
  mem: number;
}

interface HistoryChartProps {
  history: HistoryPoint[];
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ history }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // 1. Initialize ECharts instance once on mount
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  // 2. Perform delta updates when history changes
  useEffect(() => {
    if (!chartInstanceRef.current || !chartRef.current) return;

    // Dynamically retrieve CSS colors from the DOM for light/dark theme compliance
    const computedStyles = window.getComputedStyle(chartRef.current);
    const textColor = computedStyles.getPropertyValue('--color-text-base').trim() || '#ffffff';
    const subtextColor = computedStyles.getPropertyValue('--color-text-dim').trim() || '#a1a1aa';
    const borderColor = computedStyles.getPropertyValue('--color-border').trim() || '#27272a';
    const tooltipBg = computedStyles.getPropertyValue('--color-surface-3').trim() || '#18181b';

    const times = history.map((h) => h.time);
    const cpuData = history.map((h) => h.cpu);
    const memData = history.map((h) => h.mem);

    const option: echarts.EChartsOption = {
      grid: {
        top: '16%',
        left: '4%',
        right: '4%',
        bottom: '12%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: borderColor,
        borderWidth: 1,
        textStyle: {
          color: textColor,
          fontSize: 10,
          fontFamily: 'monospace'
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          let res = `<div style="font-weight:bold; margin-bottom: 4px; font-size:10px;">Time: ${params[0].name}</div>`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          params.forEach((item: any) => {
            const val = typeof item.value === 'number' ? item.value.toFixed(1) : item.value;
            res += `<div style="display:flex; justify-content:between; align-items:center; gap: 8px; font-size:10px;">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${item.color};"></span>
              <span>${item.seriesName}:</span>
              <span style="font-weight:bold; margin-left:auto;">${val}%</span>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        data: ['CPU Usage', 'Memory Usage'],
        textStyle: {
          color: subtextColor,
          fontSize: 9,
          fontFamily: 'sans-serif'
        },
        top: '0%',
        right: '4%'
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLine: {
          lineStyle: { color: borderColor }
        },
        axisLabel: {
          color: subtextColor,
          fontSize: 9,
          fontFamily: 'monospace'
        }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { show: false },
        splitLine: {
          lineStyle: { color: borderColor, type: 'dashed' }
        },
        axisLabel: {
          color: subtextColor,
          fontSize: 9,
          fontFamily: 'monospace',
          formatter: '{value}%'
        }
      },
      series: [
        {
          name: 'CPU Usage',
          type: 'line',
          data: cpuData,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: '#10b981',
            width: 1.5
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.20)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.00)' }
            ])
          }
        },
        {
          name: 'Memory Usage',
          type: 'line',
          data: memData,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: '#06b6d4',
            width: 1.5
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(6, 182, 212, 0.20)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0.00)' }
            ])
          }
        }
      ]
    };

    chartInstanceRef.current.setOption(option);
  }, [history]);

  return (
    <div className={cn('p-2 flex flex-col gap-2 h-[280px] select-none min-w-0 w-full relative')}>
      <span className="text-xs font-bold text-text-base uppercase tracking-wider font-sans pb-1.5 border-b border-border/40 truncate shrink-0">
        Live Utilization Timeline
      </span>

      {/* Chart container - always rendered so chartRef is captured on mount */}
      <div ref={chartRef} className="flex-1 w-full mt-2" />

      {/* Waiting overlay - absolutely overlayed when history is empty */}
      {history.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-editor-bg/85 text-[10px] text-zinc-550 italic z-10 pointer-events-none mt-8">
          Waiting for live metrics ticks...
        </div>
      )}
    </div>
  );
};
