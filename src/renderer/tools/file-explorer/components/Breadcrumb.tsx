import { ChevronRight, HardDrive } from 'lucide-react';
import { cn } from 'cnfast';
import { useEffect, useState } from 'react';
import { Menu } from '@renderer/components/ui/Menu';
import { splitPathSegments } from '../lib/paths';
import { getFavoriteIcon } from '../lib/sidebarIcons';
import type { SidebarSections } from '../../../../preload/file-explorer/api';

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumb({ currentPath, onNavigate }: BreadcrumbProps) {
  const segments = splitPathSegments(currentPath);

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border-dark bg-surface-2 text-xs overflow-x-auto shrink-0 select-none">
      <BreadcrumbLocationPicker onNavigate={onNavigate} />
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={segment.path} className="flex items-center gap-1 shrink-0">
            {i > 0 && <BreadcrumbSegmentMenu path={segments[i - 1].path} onNavigate={onNavigate} />}
            <button
              onClick={() => onNavigate(segment.path)}
              disabled={isLast}
              className={cn(
                'px-1.5 py-0.5 rounded max-w-48 truncate',
                isLast
                  ? 'text-text-base font-medium cursor-default'
                  : 'text-text-dim cursor-pointer hover:bg-surface-4'
              )}
            >
              {segment.label}
            </button>
          </span>
        );
      })}
      {segments.length > 0 && (
        <BreadcrumbSegmentMenu path={segments[segments.length - 1].path} onNavigate={onNavigate} />
      )}
    </div>
  );
}

function BreadcrumbLocationPicker({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [sections, setSections] = useState<SidebarSections | null>(null);

  useEffect(() => {
    window.fileExplorer.getSidebarSections().then(setSections);
  }, []);

  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex items-center shrink-0 px-1.5 py-0.5 rounded text-text-dim hover:bg-surface-4 cursor-pointer"
        title="Locations"
      >
        <HardDrive size={14} />
      </Menu.Trigger>
      <Menu.Content align="start">
        {sections && sections.favorites.length > 0 && (
          <Menu.Group>
            <Menu.GroupLabel>Favorites</Menu.GroupLabel>
            {sections.favorites.map((item) => {
              const Icon = getFavoriteIcon(item.label);
              return (
                <Menu.Item key={item.path} onClick={() => onNavigate(item.path)}>
                  <Icon size={14} className="shrink-0 text-zinc-500" />
                  <span className="truncate">{item.label}</span>
                </Menu.Item>
              );
            })}
          </Menu.Group>
        )}
        {sections && sections.locations.length > 0 && (
          <Menu.Group>
            <Menu.GroupLabel>Locations</Menu.GroupLabel>
            {sections.locations.map((item) => (
              <Menu.Item key={item.path} onClick={() => onNavigate(item.path)}>
                <HardDrive size={14} className="shrink-0 text-zinc-500" />
                <span className="truncate">{item.label}</span>
              </Menu.Item>
            ))}
          </Menu.Group>
        )}
      </Menu.Content>
    </Menu.Root>
  );
}

type SubfolderState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      folders: { name: string; path: string }[];
    };

function BreadcrumbSegmentMenu({
  path,
  onNavigate
}: {
  path: string;
  onNavigate: (path: string) => void;
}) {
  const [state, setState] = useState<SubfolderState>({ status: 'idle' });

  function handleOpenChange(open: boolean) {
    if (!open || state.status !== 'idle') return;

    setState({ status: 'loading' });
    window.fileExplorer.listDirectory(path).then((res) => {
      if ('error' in res) {
        setState({ status: 'error' });
        return;
      }
      setState({
        status: 'ready',
        folders: res.entries
          .filter((entry) => entry.isDirectory)
          .map((entry) => ({ name: entry.name, path: entry.path }))
      });
    });
  }

  return (
    <Menu.Root onOpenChange={handleOpenChange}>
      <Menu.Trigger className="flex items-center shrink-0 rounded hover:bg-surface-4 cursor-pointer">
        <ChevronRight size={12} className="text-zinc-600 shrink-0" />
      </Menu.Trigger>
      <Menu.Content align="start">
        {state.status === 'loading' && (
          <Menu.Item disabled>
            <span className="text-text-dim">Loading…</span>
          </Menu.Item>
        )}
        {state.status === 'error' && (
          <Menu.Item disabled>
            <span className="text-text-dim">Cannot access this folder</span>
          </Menu.Item>
        )}
        {state.status === 'ready' && state.folders.length === 0 && (
          <Menu.Item disabled>
            <span className="text-text-dim">No subfolders</span>
          </Menu.Item>
        )}
        {state.status === 'ready' &&
          state.folders.map((folder) => (
            <Menu.Item key={folder.path} onClick={() => onNavigate(folder.path)}>
              <span className="truncate">{folder.name}</span>
            </Menu.Item>
          ))}
      </Menu.Content>
    </Menu.Root>
  );
}
