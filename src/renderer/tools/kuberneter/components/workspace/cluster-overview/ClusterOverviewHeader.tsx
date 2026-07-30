import type React from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { Select } from '@renderer/components/ui/Select';
import { cn } from 'cnfast';
import type { NodeResource } from './types';
import { isMasterNode, isWorkerNode } from './clusterMetrics';

interface ClusterOverviewHeaderProps {
  nodesFilter: string;
  setNodesFilter: (val: string) => void;
  nodes: NodeResource[];
  timeRange: string;
  setTimeRange: (val: string) => void;
  refreshInterval: string;
  setRefreshInterval: (val: string) => void;
  isRefreshing: boolean;
  onSync: () => void;
}

export const ClusterOverviewHeader: React.FC<ClusterOverviewHeaderProps> = ({
  nodesFilter,
  setNodesFilter,
  nodes,
  timeRange,
  setTimeRange,
  refreshInterval,
  setRefreshInterval,
  isRefreshing,
  onSync
}) => {
  const masterCount = nodes.filter(isMasterNode).length;
  const workerCount = nodes.filter(isWorkerNode).length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      {/* Left side: Nodes Filter Dropdown */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-sans">
          Nodes:
        </span>
        <Select.Root value={nodesFilter} onValueChange={(val) => val && setNodesFilter(val)}>
          <Select.Trigger className="h-7 text-[10px] py-1 px-2 border border-border bg-surface font-sans min-w-[140px] flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 truncate">
              <Cpu className="size-3 text-accent shrink-0" />
              <Select.Value placeholder="Select node..." />
            </div>
          </Select.Trigger>
          <Select.Content side="bottom" align="start">
            <Select.Item value="all">
              <Select.ItemText>All Nodes ({nodes.length})</Select.ItemText>
            </Select.Item>
            <Select.Item value="master">
              <Select.ItemText>Master / Control-Plane ({masterCount})</Select.ItemText>
            </Select.Item>
            <Select.Item value="worker">
              <Select.ItemText>Worker Nodes ({workerCount})</Select.ItemText>
            </Select.Item>

            {nodes.length > 0 && <div className="my-1 border-t border-border-dark/60" />}

            {nodes.map((node) => {
              const name = node.metadata?.name || '';
              return (
                <Select.Item key={name} value={name}>
                  <Select.ItemText>{name}</Select.ItemText>
                </Select.Item>
              );
            })}
          </Select.Content>
        </Select.Root>
      </div>

      {/* Right side: History, Interval, Sync controls */}
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
