import {
  MoreHorizontal,
  TrendingUp,
  Users,
  Activity,
  RefreshCw,
  type LucideIcon
} from 'lucide-react';
import { Popover } from '@renderer/components/ui/Popover';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { Button } from '@renderer/components/ui/Button';
import { Toolbar } from '@renderer/components/ui/Toolbar';

interface Stat {
  id: string;
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
}

const STATS: Stat[] = [
  { id: 'requests', label: 'Requests today', value: '4,213', delta: '+12%', icon: Activity },
  { id: 'members', label: 'Team members', value: '18', delta: '+2', icon: Users },
  { id: 'uptime', label: 'Uptime', value: '99.98%', delta: '+0.1%', icon: TrendingUp }
];

export function DashboardMockup() {
  return (
    <div className="flex h-[32rem] w-full flex-col overflow-hidden rounded-md border border-border">
      <Toolbar.Root>
        <span className="px-3 text-[13px] font-medium">Project Overview</span>
        <div className="flex-1" />
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Toolbar.Button shape="square">
                  <RefreshCw size={14} />
                </Toolbar.Button>
              }
            />
            <Tooltip.Content side="bottom">Refresh</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <div className="px-2">
          <Button size="sm">New request</Button>
        </div>
      </Toolbar.Root>

      <div className="flex-1 overflow-y-auto bg-surface-2 p-6">
        <div className="grid grid-cols-3 gap-4">
          {STATS.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2">
          <Icon size={16} />
        </span>
        <Popover.Root>
          <Popover.Trigger
            render={
              <button className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-3">
                <MoreHorizontal size={14} />
              </button>
            }
          />
          <Popover.Content>
            <div className="flex flex-col gap-1 text-[13px]">
              <button className="rounded-sm px-2 py-1.5 text-left hover:bg-surface-2">
                View details
              </button>
              <button className="rounded-sm px-2 py-1.5 text-left hover:bg-surface-2">
                Export CSV
              </button>
            </div>
          </Popover.Content>
        </Popover.Root>
      </div>
      <div>
        <div className="text-xl font-medium text-foreground">{stat.value}</div>
        <div className="text-xs text-muted-foreground">{stat.label}</div>
      </div>
      <span className="text-[11px] text-accent">{stat.delta} this week</span>
    </div>
  );
}
