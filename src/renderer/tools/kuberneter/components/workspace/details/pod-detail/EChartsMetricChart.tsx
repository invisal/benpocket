import type React from 'react';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

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
}

export const EChartsMetricChart: React.FC<EChartsMetricChartProps> = ({
  title,
  timeLabels,
  series,
  unit = '',
  height = 160
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas'
      });
    }

    const computedStyle = getComputedStyle(document.documentElement);
    const textColor =
      computedStyle.getPropertyValue('--color-muted-foreground').trim() || '#a1a1aa';
    const gridLineColor = computedStyle.getPropertyValue('--color-border').trim() || '#27272a';

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: title
        ? {
            text: title,
            textStyle: {
              color: textColor,
              fontSize: 10,
              fontFamily: 'monospace'
            },
            top: 0,
            left: 0
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#18181b',
        borderColor: '#27272a',
        textStyle: { color: '#e4e4e7', fontSize: 11 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          let res = `<div style="font-size:10px;font-family:monospace;margin-bottom:4px;color:#a1a1aa">${params[0].axisValue}</div>`;
          params.forEach((p) => {
            const valNum = typeof p.value === 'number' ? p.value : parseFloat(p.value);
            const formatted = isNaN(valNum) ? p.value : valNum.toFixed(2);
            res += `<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-family:monospace;margin-top:2px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color}"></span>
              <span>${p.seriesName}: <b style="color:#f4f4f5">${formatted} ${unit}</b></span>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        top: 0,
        right: 0,
        icon: 'rect',
        itemWidth: 10,
        itemHeight: 6,
        textStyle: { color: textColor, fontSize: 9, fontFamily: 'monospace' }
      },
      grid: {
        top: 26,
        left: 42,
        right: 12,
        bottom: 24,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: timeLabels,
        axisLine: { lineStyle: { color: gridLineColor } },
        axisLabel: { color: textColor, fontSize: 9, fontFamily: 'monospace' },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: gridLineColor, type: 'dashed', opacity: 0.3 } },
        axisLabel: {
          color: textColor,
          fontSize: 9,
          fontFamily: 'monospace',
          formatter: (v: number) => `${v.toFixed(1)}${unit ? ' ' + unit : ''}`
        }
      },
      series: series.map((s) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: s.color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${s.color}33` },
            { offset: 1, color: `${s.color}00` }
          ])
        },
        data: s.data
      }))
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(chartRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [title, timeLabels, series, unit]);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
};
