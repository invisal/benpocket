import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { useToolTabs } from '@renderer/components/providers/ToolProvider';
import { useLayoutStore } from '@renderer/store/layout.store';
import { CameraIcon, CloudIcon, FolderOpen, GlobeIcon, SearchIcon, VideoIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from 'cnfast';
import kuberneterIcon from '@renderer/assets/kuberneter-icon.svg';
import { ConnectCloudflareDialog } from '@renderer/components/dialog/ConnectCloudflareDialog';

interface Props {}

interface ToolEntry {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}

// eslint-disable-next-line no-empty-pattern
export function HomeMain({}: ToolComponentProps<Props>) {
  const { openTab } = useToolTabs();
  const [query, setQuery] = useState('');
  const [cloudflareDialogOpen, setCloudflareDialogOpen] = useState(false);

  const tools: ToolEntry[] = useMemo(
    () => [
      {
        id: 'kuberneter',
        name: 'Kubernetes',
        description: 'Connect to a cluster and manage workloads.',
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
        icon: <GlobeIcon size={20} />,
        onClick: () => openTab('http-client', {})
      },
      {
        id: 'screen-recorder',
        name: 'Screen Recorder',
        description: 'Record and export your screen.',
        icon: <VideoIcon size={20} />,
        onClick: () => openTab('screen-recorder', {})
      },
      {
        id: 'screen-capture',
        name: 'Screen Capture',
        description: 'Capture a still image from your screen.',
        icon: <CameraIcon size={20} />,
        onClick: () => openTab('screen-capture', {})
      },
      {
        id: 'file-explorer',
        name: 'File Explorer',
        description: 'Browse files on your computer.',
        icon: <FolderOpen size={20} />,
        onClick: () => openTab('file-explorer', {})
      },
      {
        id: 'cloudflare',
        name: 'Connect Cloudflare',
        description: 'Link your Cloudflare account to browse R2 buckets and more.',
        icon: <CloudIcon size={20} />,
        onClick: () => setCloudflareDialogOpen(true)
      }
    ],
    [openTab]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (tool) => tool.name.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q)
    );
  }, [tools, query]);

  return (
    <div className="bg-surface w-full h-screen overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-14">
        <div className="flex items-center gap-2">
          <svg className="size-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,2 2,22 22,22" />
          </svg>
          <h1 className="font-semibold text-xl">Benpocket</h1>
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

        {filtered.length === 0 ? (
          <div className="text-sm text-text-dim border border-dashed border-border rounded-lg py-10 text-center">
            No tools match &quot;{query}&quot;
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </div>

      <ConnectCloudflareDialog open={cloudflareDialogOpen} onOpenChange={setCloudflareDialogOpen} />
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
