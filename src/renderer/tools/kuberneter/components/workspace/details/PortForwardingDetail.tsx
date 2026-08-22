import type React from 'react';
import { useCallback, useState } from 'react';
import { type PortForwardData } from '../../../types/PortForwardData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useOpenNamespaceDetail, useOpenResourceDetail } from '../../../hooks/open-detail';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { cn } from 'cnfast';

interface PortForwardingDetailProps {
  payload: PortForwardData;
  isTab?: boolean;
}

function StatusValue({ status }: { status: PortForwardData['status'] }) {
  return (
    <span
      className={cn(
        'font-mono font-semibold',
        status === 'Active' && 'text-green-400',
        status === 'Stopped' && 'text-zinc-500',
        status === 'Error' && 'text-red-400'
      )}
    >
      {status}
    </span>
  );
}

function TunnelTypeValue({ type }: { type?: PortForwardData['tunnelType'] }) {
  if (type === 'cloudflare') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
        Cloudflare Quick Tunnel
      </span>
    );
  }
  if (type === 'ngrok') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
        ngrok Public Tunnel
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-3 text-muted-foreground border border-border/40">
      Localhost
    </span>
  );
}

function UrlProperty({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-accent hover:underline flex items-center gap-1 text-[11px]"
      >
        <span>{url}</span>
        <ExternalLink className="size-3" />
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 text-muted-foreground hover:text-foreground bg-surface-2 hover:bg-surface-3 rounded border border-border/40 cursor-pointer flex items-center gap-1 text-[10px]"
        title="Copy URL"
      >
        {copied ? (
          <>
            <Check className="size-3 text-green-400" />
            <span className="text-green-400">Copied</span>
          </>
        ) : (
          <>
            <Copy className="size-3" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

export const PortForwardingDetail: React.FC<PortForwardingDetailProps> = ({
  payload,
  isTab = false
}) => {
  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openResourceDetail } = useOpenResourceDetail();

  const handleResourceClick = useCallback(() => {
    if (payload?.name && payload?.kind) {
      openResourceDetail(payload.kind, payload.ns, payload.name);
    }
  }, [payload, openResourceDetail]);

  const handleNamespaceClick = useCallback(() => {
    if (payload?.ns) {
      openNamespaceDetail(payload.ns);
    }
  }, [payload, openNamespaceDetail]);

  const propertiesData: PropertyItem[] = [
    {
      id: 'name',
      name: 'Resource Name',
      value: payload ? (
        <span
          onClick={handleResourceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {payload.name}
        </span>
      ) : (
        ''
      )
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: payload ? (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {payload.ns}
        </span>
      ) : (
        ''
      )
    },
    {
      id: 'kind',
      name: 'Kind',
      value: payload?.kind || ''
    },
    {
      id: 'podPort',
      name: 'Pod Port',
      value: payload ? String(payload.podPort) : ''
    },
    {
      id: 'localPort',
      name: 'Local Port',
      value: payload ? String(payload.localPort) : ''
    },
    {
      id: 'tunnelType',
      name: 'Exposure Type',
      value: payload ? <TunnelTypeValue type={payload.tunnelType} /> : ''
    },
    {
      id: 'url',
      name: 'Active URL',
      value: payload?.url ? <UrlProperty url={payload.url} /> : ''
    },
    {
      id: 'protocol',
      name: 'Protocol',
      value: payload?.protocol || ''
    },
    {
      id: 'status',
      name: 'Status',
      value: payload ? <StatusValue status={payload.status} /> : ''
    }
  ];

  if (!payload) {
    return <div className="p-4 text-sm text-zinc-500">No Port Forward details available.</div>;
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <KubePropertiesTable properties={propertiesData} />
      </div>
    </div>
  );
};
