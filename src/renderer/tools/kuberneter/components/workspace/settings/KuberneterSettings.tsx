import type { FC, ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import { BarChart2, Terminal, Package } from 'lucide-react';
import { MetricsSettings } from '../metrics-settings/MetricsSettings';
import { KubectlSettings } from '../kubectl-settings/KubectlSettings';
import { HelmSettings } from '../helm-settings/HelmSettings';
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
    id: 'helm',
    label: 'Helm CLI',
    description: 'Configure executable path and check availability',
    icon: Package,
    content: <HelmSettings />
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

export interface KuberneterSettingsProps {
  section?: string;
}

export const KuberneterSettings: FC<KuberneterSettingsProps> = ({ section }) => {
  const [activeId, setActiveId] = useState(() => {
    if (section && SETTINGS_SECTIONS.some((s) => s.id === section)) {
      return section;
    }
    return SETTINGS_SECTIONS[0].id;
  });
  const [prevSection, setPrevSection] = useState(section);

  if (section !== prevSection) {
    setPrevSection(section);
    if (section && SETTINGS_SECTIONS.some((s) => s.id === section)) {
      setActiveId(section);
    }
  }

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
                  className="px-3.5 py-1.5 text-sm font-semibold"
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
