import type React from 'react';
import { MoreVertical, Filter, BarChart2, RefreshCw, Flag } from 'lucide-react';

export interface MetricsBarChartProps {
  series: Array<{ name: string; color: string; values: number[] }>;
  timeLabels: string[];
  yTicks: string[];
}

export const MetricsBarChart: React.FC<MetricsBarChartProps> = ({ series, timeLabels, yTicks }) => {
  return (
    <div className="flex flex-col gap-2 bg-surface-2/40 border border-border/40 rounded-lg p-3">
      {/* Chart Toolbar */}
      <div className="flex justify-between items-center text-[10px]">
        <div className="flex items-center gap-2">
          <select className="bg-surface-3 border border-border-dark text-zinc-300 rounded px-1.5 py-0.5 text-[10px] outline-none">
            <option>1h</option>
            <option>6h</option>
            <option>24h</option>
          </select>
          <div className="flex items-center gap-1 text-zinc-500">
            <BarChart2 className="size-3 hover:text-zinc-300 cursor-pointer" />
            <RefreshCw className="size-3 hover:text-zinc-300 cursor-pointer" />
            <Filter className="size-3 hover:text-zinc-300 cursor-pointer" />
            <Flag className="size-3 hover:text-zinc-300 cursor-pointer" />
          </div>
        </div>
        <MoreVertical className="size-3.5 text-zinc-550 cursor-pointer hover:text-zinc-300" />
      </div>

      <div className="text-[10px] text-zinc-500">
        Displaying metrics from Prometheus:{' '}
        <span className="text-accent underline cursor-pointer">lens-metrics</span> /{' '}
        <span className="text-accent underline cursor-pointer">prometheus:80</span>
      </div>

      {/* SVG Bar Chart */}
      <div className="h-28 w-full bg-black/10 rounded border border-border-dark/30 relative flex flex-col justify-between p-2 select-none">
        {/* Y Axis Labels */}
        <div className="absolute right-2 top-1 bottom-6 flex flex-col justify-between text-[9px] font-mono text-zinc-500 text-right pointer-events-none z-10">
          {yTicks.map((tick, i) => (
            <span key={i}>{tick}</span>
          ))}
        </div>

        {/* Horizontal Grid lines */}
        <div className="absolute inset-x-2 top-2 bottom-6 flex flex-col justify-between pointer-events-none opacity-20">
          {yTicks.map((_, i) => (
            <div key={i} className="border-b border-zinc-600 w-full" />
          ))}
        </div>

        {/* Bars Container */}
        <div className="flex-1 flex items-end justify-between gap-1 px-2 pb-1 pt-1 z-0">
          {timeLabels.map((_, idx) => (
            <div key={idx} className="flex-1 flex items-end justify-center h-full gap-0.5">
              {series.map((s, sIdx) => {
                const sVal = s.values[idx % s.values.length] || 0.05;
                const sHeightPct = Math.min(100, Math.max(8, (sVal / 0.2) * 100));
                return (
                  <div
                    key={sIdx}
                    className="w-1.5 rounded-t-xs transition-all hover:brightness-125"
                    style={{ height: `${sHeightPct}%`, backgroundColor: s.color }}
                    title={`${s.name}: ${sVal}`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* X Axis Time Labels */}
        <div className="flex justify-between items-center text-[9px] font-mono text-zinc-550 pt-1 border-t border-border/20 px-1">
          {timeLabels.map((time, i) => (
            <span key={i}>{time}</span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-400 pt-0.5 justify-start">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-xs" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
};
