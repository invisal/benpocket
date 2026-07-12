import { ChevronRight, HardDrive } from 'lucide-react';
import { cn } from 'cnfast';
import { useEffect, useRef, useState } from 'react';
import { Menu } from '@renderer/components/ui/Menu';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { splitPathSegments } from '../lib/paths';
import { getFavoriteIcon } from '../lib/sidebarIcons';
import type { SidebarSections } from '../../../../preload/file-explorer/api';
import type { Panel2Mode } from '../store/fileExplorer.store';

interface BreadcrumbModeSwitch {
  value: Panel2Mode;
  onChange: (mode: Panel2Mode) => void;
}

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  modeSwitch?: BreadcrumbModeSwitch;
  /** False when there's no folder to show a path for (e.g. panel 2 in preview mode). Defaults to true. */
  showPath?: boolean;
}

export function Breadcrumb(props: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 p-1 px-1 bg-surface border-b border-border">
      <BreadcrumbInner {...props} />
    </div>
  );
}

export function BreadcrumbInner({
  currentPath,
  onNavigate,
  modeSwitch,
  showPath = true
}: BreadcrumbProps) {
  const segments = splitPathSegments(currentPath);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      {showPath && (
        <>
          <div>
            <BreadcrumbLocationPicker onNavigate={onNavigate} />
          </div>
          {isEditing ? (
            <BreadcrumbPathInput
              currentPath={currentPath}
              onNavigate={onNavigate}
              onDone={() => setIsEditing(false)}
            />
          ) : (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsEditing(true);
              }}
              className={cn(
                'flex flex-1 items-center px-1 h-8 text-xs overflow-x-auto shrink-0 select-none gap-2 px-3', // Layout
                'bg-surface-2', // Background
                'border border-border rounded', // Border
                'shadow-[inset_0_1px_2px_rgba(0,0,0,0.12),inset_0_-1px_0_rgba(255,255,255,0.05)]' // 3D inset
              )}
            >
              {segments.map((segment, i) => {
                const isLast = i === segments.length - 1;
                return (
                  <span key={segment.path} className="flex items-center gap-1 shrink-0">
                    {i > 0 && (
                      <BreadcrumbSegmentMenu path={segments[i - 1].path} onNavigate={onNavigate} />
                    )}
                    <ContextMenu.Root>
                      <ContextMenu.Trigger
                        render={
                          <button
                            onClick={() => !isLast && onNavigate(segment.path)}
                            className={cn(
                              'px-0 h-6 rounded max-w-48 truncate text-xs border border-surface-2 cursor-pointer', // Layout
                              'text-text-dim hover:bg-surface hover:border-border hover:px-1.5 hover:-mx-1.5', // Color + hover
                              'data-[popup-open]:bg-surface data-[popup-open]:border-border data-[popup-open]:px-1.5 data-[popup-open]:-mx-1.5' // Keep hover style while menu is open
                            )}
                          >
                            {segment.label}
                          </button>
                        }
                      />
                      <ContextMenu.Content side="bottom" align="start">
                        <ContextMenu.Item
                          onClick={() => navigator.clipboard.writeText(segment.path)}
                        >
                          Copy address
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          onClick={() => navigator.clipboard.writeText(segment.label)}
                        >
                          Copy name
                        </ContextMenu.Item>
                      </ContextMenu.Content>
                    </ContextMenu.Root>
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}
      {!showPath && <div className="flex-1" />}
      {modeSwitch && <BreadcrumbModeSwitch modeSwitch={modeSwitch} />}
    </>
  );
}

function BreadcrumbModeSwitch({ modeSwitch }: { modeSwitch: BreadcrumbModeSwitch }) {
  const { value, onChange } = modeSwitch;

  return (
    <div className="flex items-center gap-0.5 shrink-0 p-0.5 rounded border border-border bg-surface-2">
      <button
        onClick={() => onChange('table')}
        className={cn(
          'px-2 h-6 rounded text-xs cursor-pointer transition-colors', // Layout
          value === 'table'
            ? 'bg-surface-4 text-text-base'
            : 'text-text-dim hover:bg-surface-3 hover:text-text-base'
        )}
      >
        Explorer
      </button>
      <button
        onClick={() => onChange('preview')}
        className={cn(
          'px-2 h-6 rounded text-xs cursor-pointer transition-colors', // Layout
          value === 'preview'
            ? 'bg-surface-4 text-text-base'
            : 'text-text-dim hover:bg-surface-3 hover:text-text-base'
        )}
      >
        Preview
      </button>
    </div>
  );
}

function BreadcrumbPathInput({
  currentPath,
  onNavigate,
  onDone
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(currentPath);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function commit() {
    committedRef.current = true;
    const trimmed = value.trim();
    if (!trimmed || trimmed === currentPath) {
      onDone();
      return;
    }
    const res = await window.fileExplorer.listDirectory(trimmed);
    if ('error' in res) {
      onDone();
      return;
    }
    onNavigate(trimmed);
    onDone();
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (!committedRef.current) onDone();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onDone();
        }
      }}
      className={cn(
        'flex-1 h-8 px-3 text-xs', // Layout
        'bg-surface-2', // Background
        'border border-border rounded', // Border
        'text-text-base outline-none', // Text
        'shadow-[inset_0_1px_2px_rgba(0,0,0,0.12),inset_0_-1px_0_rgba(255,255,255,0.05)]' // 3D inset
      )}
    />
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
        title="Locations"
        render={
          <button className="h-8 w-8 flex items-center justify-center hover:bg-surface-2 rounded border border-transparent hover:border-border cursor-pointer">
            <HardDrive size={14} />
          </button>
        }
      />

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
  const [isOpen, setIsOpen] = useState(false);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
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
      <Menu.Trigger
        className={cn(
          'flex items-center h-6 p-0 justify-center shrink-0 rounded border border-transparent cursor-pointer', // Layout
          'hover:bg-surface hover:border-border hover:px-0.5 hover:-mx-0.5', // Hover
          'data-[popup-open]:bg-surface data-[popup-open]:border-border data-[popup-open]:px-0.5 data-[popup-open]:-mx-0.5' // Keep hover style while menu is open
        )}
      >
        <ChevronRight
          size={12}
          className={cn(
            'text-zinc-600 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-90'
          )}
        />
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
