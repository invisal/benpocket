import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { Select } from '@renderer/components/ui/Select';
import { cn } from 'cnfast';

interface ClusterOverviewHeaderProps {
  timeRange: string;
  setTimeRange: (val: string) => void;
  refreshInterval: string;
  setRefreshInterval: (val: string) => void;
  isRefreshing: boolean;
  onSync: () => void;
}

export const ClusterOverviewHeader: React.FC<ClusterOverviewHeaderProps> = ({
  timeRange,
  setTimeRange,
  refreshInterval,
  setRefreshInterval,
  isRefreshing,
  onSync
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-text-base uppercase tracking-wider font-sans">
          Cluster Pulse
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Time range history window */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-sans">
            History:
          </span>
          <Select.Root value={timeRange} onValueChange={(val) => val && setTimeRange(val)}>
            <Select.Trigger className="h-7 text-[10px] py-1 px-2 border border-border bg-surface font-sans min-w-[100px] flex items-center justify-between gap-1">
              <Select.Value />
            </Select.Trigger>
            <Select.Content side="bottom" align="start">
              <Select.Item value="1h">
                <Select.ItemText>1h (20 Ticks)</Select.ItemText>
              </Select.Item>
              <Select.Item value="6h">
                <Select.ItemText>6h (50 Ticks)</Select.ItemText>
              </Select.Item>
              <Select.Item value="12h">
                <Select.ItemText>12h (100 Ticks)</Select.ItemText>
              </Select.Item>
              <Select.Item value="24h">
                <Select.ItemText>24h (200 Ticks)</Select.ItemText>
              </Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        {/* Refresh polling interval */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-sans">
            Interval:
          </span>
          <Select.Root
            value={refreshInterval}
            onValueChange={(val) => val && setRefreshInterval(val)}
          >
            <Select.Trigger className="h-7 text-[10px] py-1 px-2 border border-border bg-surface font-sans min-w-[100px] flex items-center justify-between gap-1">
              <Select.Value />
            </Select.Trigger>
            <Select.Content side="bottom" align="start">
              <Select.Item value="off">
                <Select.ItemText>Off (Manual)</Select.ItemText>
              </Select.Item>
              <Select.Item value="5s">
                <Select.ItemText>5 seconds</Select.ItemText>
              </Select.Item>
              <Select.Item value="10s">
                <Select.ItemText>10 seconds</Select.ItemText>
              </Select.Item>
              <Select.Item value="30s">
                <Select.ItemText>30 seconds</Select.ItemText>
              </Select.Item>
              <Select.Item value="60s">
                <Select.ItemText>60 seconds</Select.ItemText>
              </Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        {/* Sync Button */}
        <Button
          onClick={onSync}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="gap-1.5 h-7 text-[10px]"
        >
          <RefreshCw className={cn('size-3 text-accent', isRefreshing && 'animate-spin')} />
          <span>Sync</span>
        </Button>
      </div>
    </div>
  );
};
