import type React from 'react';
import { useState, useRef } from 'react';
import { BarChart2, SlidersHorizontal } from 'lucide-react';
import { MetricsSettings } from '../metrics-settings/MetricsSettings';
import { cn } from 'cnfast';

// ─── Settings section registry ────────────────────────────────────────────────

interface SettingsSectionDef {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    id: 'metrics',
    label: 'Metrics',
    description: 'Configure data source for resource charts',
    icon: BarChart2,
    content: <MetricsSettings />
  },
  {
    id: 'general',
    label: 'General',
    description: 'Refresh interval and display preferences',
    icon: SlidersHorizontal,
    content: (
      <div className="flex flex-col gap-6 p-6 max-w-xl">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Refresh Interval</span>
          <p className="text-xs text-muted-foreground">
            The resource list refresh interval is controlled per-instance from the toolbar at the
            top of the workspace. Use the dropdown there to switch between 15 s, 30 s, 60 s, or 5
            min cadences.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Kubeconfig Files</span>
          <p className="text-xs text-muted-foreground">
            Kubeconfig paths are added and removed from the Kuberneter Home screen. Navigate there
            by opening a new Kuberneter tab without connecting to a cluster.
          </p>
        </div>
      </div>
    )
  }
];

// ─── Main page ────────────────────────────────────────────────────────────────

export const KuberneterSettings: React.FC = () => {
  const [activeId, setActiveId] = useState(SETTINGS_SECTIONS[0].id);
  const activeSection = SETTINGS_SECTIONS.find((s) => s.id === activeId) ?? SETTINGS_SECTIONS[0];
  const tabsRef = useRef<HTMLDivElement>(null);

  // Mouse-drag horizontal scroll on the tab bar
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0 });

  function onMouseDown(e: React.MouseEvent) {
    const el = tabsRef.current;
    if (!el) return;
    dragState.current = { dragging: true, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragState.current.dragging || !tabsRef.current) return;
    const dx = e.clientX - dragState.current.startX;
    tabsRef.current.scrollLeft = dragState.current.scrollLeft - dx;
  }

  function onMouseUp() {
    if (!tabsRef.current) return;
    dragState.current.dragging = false;
    tabsRef.current.style.cursor = '';
    tabsRef.current.style.userSelect = '';
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Header row — h-11 matches KubeWorkspaceLayout; tabs sit inside it ── */}
      <div className="h-11 shrink-0 border-b border-border-dark">
        <div
          ref={tabsRef}
          className="flex items-end h-full overflow-x-auto scrollbar-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {SETTINGS_SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 px-3 h-full text-xs font-medium border-none cursor-pointer transition-colors',
                  'border-b-2 -mb-px',
                  isActive
                    ? 'border-accent text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface-2/30'
                )}
              >
                <Icon
                  className={cn(
                    'size-3.5 shrink-0',
                    isActive ? 'text-accent' : 'text-muted-foreground'
                  )}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">{activeSection.content}</div>
    </div>
  );
};
