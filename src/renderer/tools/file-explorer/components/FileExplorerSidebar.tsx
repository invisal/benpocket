import { useEffect, useState, type ReactNode } from 'react';
import { CloudIcon, HardDrive, Settings2 } from 'lucide-react';
import { cn } from 'cnfast';
import type { SidebarItem, SidebarSections } from '../../../../preload/file-explorer/api';
import { useFileExplorerStore } from '../store/fileExplorer.store';
import { getFavoriteIcon, type IconComponent } from '../lib/sidebarIcons';
import { SelectR2BucketsDialog } from './SelectR2BucketsDialog';

function normalize(target: string): string {
  return target.replace(/[\\/]+$/, '').toLowerCase();
}

export function FileExplorerSidebar() {
  const [sections, setSections] = useState<SidebarSections | null>(null);
  const [bucketDialogOpen, setBucketDialogOpen] = useState(false);

  const activePanel = useFileExplorerStore((s) => s.activePanel);
  const panels = useFileExplorerStore((s) => s.panels);
  const setPanelPath = useFileExplorerStore((s) => s.setPanelPath);

  const refreshSections = () => {
    window.fileExplorer.getSidebarSections().then(setSections);
  };

  useEffect(() => {
    refreshSections();
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
      <SidebarSection
        title="R2"
        items={sections.r2Buckets}
        currentPath={activePath ?? ''}
        onNavigate={navigateActive}
        getIcon={() => CloudIcon}
        headerAction={
          <button
            title="Select R2 buckets"
            onClick={() => setBucketDialogOpen(true)}
            className="rounded p-0.5 text-zinc-500 hover:bg-surface-3 hover:text-text-base"
          >
            <Settings2 size={12} />
          </button>
        }
      />

      <SelectR2BucketsDialog
        open={bucketDialogOpen}
        onOpenChange={setBucketDialogOpen}
        onSaved={refreshSections}
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
  headerAction?: ReactNode;
}

function SidebarSection({
  title,
  items,
  currentPath,
  onNavigate,
  getIcon,
  headerAction
}: SidebarSectionProps) {
  if (items.length === 0 && !headerAction) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          {title}
        </span>
        {headerAction}
      </div>
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
