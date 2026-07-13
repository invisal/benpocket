import { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { cn } from 'cnfast';
import type { SidebarItem, SidebarSections } from '../../../../preload/file-explorer/api';
import { useFileExplorerStore } from '../store/fileExplorer.store';
import { getFavoriteIcon, IconComponent } from '../lib/sidebarIcons';

function normalize(target: string): string {
  return target.replace(/[\\/]+$/, '').toLowerCase();
}

export function FileExplorerSidebar() {
  const [sections, setSections] = useState<SidebarSections | null>(null);

  const activePanel = useFileExplorerStore((s) => s.activePanel);
  const panels = useFileExplorerStore((s) => s.panels);
  const setPanelPath = useFileExplorerStore((s) => s.setPanelPath);

  useEffect(() => {
    window.fileExplorer.getSidebarSections().then(setSections);
  }, []);

  if (!sections) return null;

  const activeIndex = activePanel === 'panel1' ? 0 : 1;
  const activePath = panels[activeIndex].path;
  const navigateActive = (path: string) => setPanelPath(activeIndex, path);

  return (
    <div className="flex flex-col gap-4">
      <SidebarSection
        title="Favorites"
        items={sections.favorites}
        currentPath={activePath ?? ''}
        onNavigate={navigateActive}
        getIcon={(item) => getFavoriteIcon(item.label)}
      />
      <SidebarSection
        title="Locations"
        items={sections.locations}
        currentPath={activePath ?? ''}
        onNavigate={navigateActive}
        getIcon={() => HardDrive}
      />
    </div>
  );
}

interface SidebarSectionProps {
  title: string;
  items: SidebarItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  getIcon: (item: SidebarItem) => IconComponent;
}

function SidebarSection({ title, items, currentPath, onNavigate, getIcon }: SidebarSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="px-2 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
        {title}
      </span>
      {items.map((item) => {
        const Icon = getIcon(item);
        const isActive = normalize(currentPath) === normalize(item.path);
        return (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            title={item.path}
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded text-xs text-left cursor-pointer transition-colors',
              isActive
                ? 'bg-surface-4 text-text-base'
                : 'text-text-dim hover:bg-surface-3 hover:text-text-base'
            )}
          >
            <Icon size={14} className="shrink-0 text-zinc-500" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
