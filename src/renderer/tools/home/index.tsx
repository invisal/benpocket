import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { useToolTabs } from '@renderer/components/providers/ToolProvider';
import { useLayoutStore } from '@renderer/store/layout.store';
import { CameraIcon, CloudIcon, FolderOpen, GlobeIcon, VideoIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from 'cnfast';
import kuberneterIcon from '@renderer/assets/kuberneter-icon.svg';
import { ConnectCloudflareDialog } from '@renderer/components/dialog/ConnectCloudflareDialog';
import { Button } from '@renderer/components/ui/Button';
import { Toolbar } from '@renderer/components/ui/Toolbar';

interface Props {}

type CloudflareStatus = 'loading' | 'configured' | 'empty';

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
  const [cloudflareStatus, setCloudflareStatus] = useState<CloudflareStatus>('loading');

  useEffect(() => {
    window.fileExplorer.getR2CredentialStatus().then((res) => {
      setCloudflareStatus(res.configured ? 'configured' : 'empty');
    });
  }, [cloudflareDialogOpen]);

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
    <div className="bg-surface w-full h-screen flex flex-col">
      <div className="flex flex-col text-sm border-b border-border text-muted-foreground p-4">
        <strong>benpocket</strong>
        <p>Developer tools, all in one place.</p>
      </div>

      <Toolbar.Root>
        <div className="h-9">
          <input
            className="h-9 outline-none px-4 text-xs w-72"
            placeholder="Search your tools"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) filtered[0].onClick();
            }}
          />
        </div>
        <Toolbar.Button>Some Random</Toolbar.Button>
        <Toolbar.Button>Some Random</Toolbar.Button>
        <div className="h-full flex-1 bg-diagonal-stripes" />
      </Toolbar.Root>

      <div className="p-6 flex-1 bg-surface-2 bg-dotted">
        <div>
          {filtered.length === 0 ? (
            <div className="text-sm text-text-dim border border-dashed border-border rounded-lg py-10 text-center">
              No tools match &quot;{query}&quot;
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {filtered.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CloudflareBanner status={cloudflareStatus} onClick={() => setCloudflareDialogOpen(true)} />

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
        'w-64',
        'group flex items-start gap-3 border border-border bg-surface p-4 text-left',
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

function CloudflareBanner({ status, onClick }: { status: CloudflareStatus; onClick: () => void }) {
  return (
    <div className="border-t border-border p-6 flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-lg bg-surface-2 inline-flex items-center justify-center">
        <CloudIcon size={20} />
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="font-medium text-sm truncate">Cloudflare</span>
        <span className="text-xs text-text-dim mt-0.5 truncate">
          Link your Cloudflare account to browse R2 buckets and more.
        </span>
      </span>

      <div className="flex items-center gap-3 shrink-0">
        {status === 'configured' ? (
          <button
            role="button"
            onClick={onClick}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-surface-2 border border-border hover:bg-surface-3 transition-colors"
          >
            Disconnect
          </button>
        ) : status === 'empty' ? (
          <Button onClick={onClick} variant="primary">
            Connect with your Cloudflare
          </Button>
        ) : null}
      </div>
    </div>
  );
}
