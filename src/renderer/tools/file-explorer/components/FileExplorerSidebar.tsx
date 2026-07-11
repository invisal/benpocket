import { ComponentType, useEffect, useState } from 'react';
import { Download, FileText, HardDrive, Home, Monitor } from 'lucide-react';
import { cn } from 'cnfast';
import type { SidebarItem, SidebarSections } from '../../../../preload/file-explorer/api';
import { useFileExplorerStore } from '../store/fileExplorer.store';

type IconComponent = ComponentType<{ size?: number; className?: string }>;

const favoriteIcons: Record<string, IconComponent> = {
  Home,
  Desktop: Monitor,
  Documents: FileText,
  Downloads: Download
};

function normalize(target: string): string {
  return target.replace(/[\\/]+$/, '').toLowerCase();
}

export function FileExplorerSidebar() {
  const [sections, setSections] = useState<SidebarSections | null>(null);

  const activePanel = useFileExplorerStore((s) => s.activePanel);
  const panel1Path = useFileExplorerStore((s) => s.panel1Path);
  const panel2Path = useFileExplorerStore((s) => s.panel2Path);
  const panel2Mode = useFileExplorerStore((s) => s.panel2Mode);
  const setPanel1Path = useFileExplorerStore((s) => s.setPanel1Path);
  const setPanel2Path = useFileExplorerStore((s) => s.setPanel2Path);
  const setPanel2Mode = useFileExplorerStore((s) => s.setPanel2Mode);

  useEffect(() => {
    window.fileExplorer.getSidebarSections().then(setSections);
  }, []);

  if (!sections) return null;

  const activePath = activePanel === 'panel1' ? panel1Path : panel2Path;
  const navigateActive = activePanel === 'panel1' ? setPanel1Path : setPanel2Path;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="px-2 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          Panel 2 View
        </span>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => setPanel2Mode('table')}
            className={cn(
              'px-2 py-1 rounded text-xs text-center cursor-pointer transition-colors',
              panel2Mode === 'table'
                ? 'bg-surface-4 text-text-base'
                : 'text-text-dim hover:bg-surface-3 hover:text-text-base'
            )}
          >
            Table
          </button>
          <button
            onClick={() => setPanel2Mode('preview')}
            className={cn(
              'px-2 py-1 rounded text-xs text-center cursor-pointer transition-colors',
              panel2Mode === 'preview'
                ? 'bg-surface-4 text-text-base'
                : 'text-text-dim hover:bg-surface-3 hover:text-text-base'
            )}
          >
            Preview
          </button>
        </div>
      </div>

      <SidebarSection
        title="Favorites"
        items={sections.favorites}
        currentPath={activePath ?? ''}
        onNavigate={navigateActive}
        getIcon={(item) => favoriteIcons[item.label] ?? Home}
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
