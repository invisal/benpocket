import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { useToolTabs } from '@renderer/components/providers/ToolProvider';
import { useLayoutStore } from '@renderer/store/layout.store';
import { CameraIcon, FolderOpen, GlobeIcon, SearchIcon, VideoIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from 'cnfast';
import kuberneterIcon from '@renderer/assets/kuberneter-icon.svg';

interface Props {}

const CATEGORY_ALL = 'All';

interface ToolEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: ReactNode;
  onClick: () => void;
}

// eslint-disable-next-line no-empty-pattern
export function HomeMain({}: ToolComponentProps<Props>) {
  const { openTab } = useToolTabs();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(CATEGORY_ALL);

  const tools: ToolEntry[] = useMemo(
    () => [
      {
        id: 'kuberneter',
        name: 'Kubernetes',
        description: 'Connect to a cluster and manage workloads.',
        category: 'Infrastructure',
        icon: <img src={kuberneterIcon} className="size-5" alt="" />,
        onClick: () => {
          const instanceId = `kuberneter-${Date.now()}`;
          useLayoutStore.getState().addActivityInstance('kuberneter', instanceId);
          openTab('kuberneter', { instanceId });
        }
      },
      {
        id: 'http-client',
        name: 'HTTP Client',
        description: 'Compose and send API requests.',
        category: 'Networking',
        icon: <GlobeIcon size={20} />,
        onClick: () => openTab('http-client', {})
      },
      {
        id: 'screen-recorder',
        name: 'Screen Recorder',
        description: 'Record and export your screen.',
        category: 'Media',
        icon: <VideoIcon size={20} />,
        onClick: () => openTab('screen-recorder', {})
      },
      {
        id: 'screen-capture',
        name: 'Screen Capture',
        description: 'Capture a still image from your screen.',
        category: 'Media',
        icon: <CameraIcon size={20} />,
        onClick: () => openTab('screen-capture', {})
      },
      {
        id: 'file-explorer',
        name: 'File Explorer',
        description: 'Browse files on your computer.',
        category: 'Files',
        icon: <FolderOpen size={20} />,
        onClick: () => openTab('file-explorer', {})
      }
    ],
    [openTab]
  );

  // Fixed order (rather than derived from filtered results) so the section list
  // doesn't reshuffle as the user types a search query.
  const categories = useMemo(
    () => [CATEGORY_ALL, ...new Set(tools.map((tool) => tool.category))],
    [tools]
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (tool) => tool.name.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q)
    );
  }, [tools, query]);

  const filtered = useMemo(
    () =>
      category === CATEGORY_ALL ? searched : searched.filter((tool) => tool.category === category),
    [searched, category]
  );

  const groups = useMemo(
    () =>
      categories
        .filter((c) => c !== CATEGORY_ALL)
        .map((c) => ({ category: c, tools: filtered.filter((tool) => tool.category === c) }))
        .filter((group) => group.tools.length > 0),
    [categories, filtered]
  );

  return (
    <div className="bg-surface w-full h-screen overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-14">
        <div className="flex items-center gap-2">
          <svg className="size-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,2 2,22 22,22" />
          </svg>
          <h1 className="font-semibold text-xl">Craftbox</h1>
        </div>
        <p className="text-sm text-text-dim mt-1">Developer tools, all in one place.</p>

        <div className="relative mt-6 mb-4">
          <SearchIcon
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none"
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) filtered[0].onClick();
            }}
            className="w-full h-10 text-sm pl-9 pr-3 rounded-lg bg-surface-2 border border-border outline-none focus-visible:border-border-dark transition-colors"
            placeholder="Search tools..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-8">
          {categories.map((c) => {
            const count =
              c === CATEGORY_ALL
                ? searched.length
                : searched.filter((tool) => tool.category === c).length;
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 h-7 text-xs font-medium transition-colors',
                  active
                    ? 'bg-surface-3 border-border-dark text-text-base'
                    : 'bg-surface-2 border-border text-text-dim hover:bg-surface-3 hover:text-text-base'
                )}
              >
                {c}
                <span className={cn('text-[11px]', active ? 'text-text-dim' : 'text-text-dim/70')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {groups.length === 0 ? (
          <div className="text-sm text-text-dim border border-dashed border-border rounded-lg py-10 text-center">
            No tools match &quot;{query}&quot;
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.category}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-medium text-text-dim uppercase tracking-wide">
                    {group.category}
                  </h2>
                  <span className="text-xs text-text-dim">{group.tools.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeMain;

function ToolCard({ tool }: { tool: ToolEntry }) {
  return (
    <button
      role="button"
      onClick={tool.onClick}
      className={cn(
        'group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left',
        'transition-colors hover:bg-surface-2 hover:border-border-dark'
      )}
    >
      <span className="size-10 shrink-0 rounded-lg bg-surface-2 group-hover:bg-surface-3 inline-flex items-center justify-center transition-colors">
        {tool.icon}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="font-medium text-sm truncate">{tool.name}</span>
        <span className="text-xs text-text-dim mt-0.5 line-clamp-2">{tool.description}</span>
      </span>
    </button>
  );
}
