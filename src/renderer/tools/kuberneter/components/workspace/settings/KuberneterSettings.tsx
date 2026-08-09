import type { FC, ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import { BarChart2, Terminal } from 'lucide-react';
import { MetricsSettings } from '../metrics-settings/MetricsSettings';
import { KubectlSettings } from '../kubectl-settings/KubectlSettings';
import { PillTab } from '@renderer/components/ui/Tabs';

// ─── Settings section registry ────────────────────────────────────────────────

interface SettingsSectionDef {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  content: ReactNode;
}

const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    id: 'kubectl',
    label: 'kubectl CLI',
    description: 'Configure executable path and check availability',
    icon: Terminal,
    content: <KubectlSettings />
  },
  {
    id: 'metrics',
    label: 'Metrics',
    description: 'Configure data source for resource charts',
    icon: BarChart2,
    content: <MetricsSettings />
  }
];

// ─── Main page ────────────────────────────────────────────────────────────────

export const KuberneterSettings: FC = () => {
  const [activeId, setActiveId] = useState(SETTINGS_SECTIONS[0].id);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PillTab.Root
        value={activeId}
        onValueChange={(v) => v && setActiveId(v)}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* ── Header row — h-11 matches KubeWorkspaceLayout ── */}
        <div className="h-11 shrink-0 border-b border-border-dark flex items-center px-4 bg-surface-1/40">
          <PillTab.List>
            {SETTINGS_SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <PillTab.Item
                  key={s.id}
                  value={s.id}
                  className="px-3.5 py-1.5 text-xs font-semibold"
                >
                  <Icon className="size-3.5 shrink-0" />
                  {s.label}
                </PillTab.Item>
              );
            })}
          </PillTab.List>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          {SETTINGS_SECTIONS.map((s) => (
            <PillTab.Panel key={s.id} value={s.id}>
              {s.content}
            </PillTab.Panel>
          ))}
        </div>
      </PillTab.Root>
    </div>
  );
};
