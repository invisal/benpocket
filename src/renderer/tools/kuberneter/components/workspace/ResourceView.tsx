import type React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface ResourceViewProps {
  isLoading: boolean;
  errorMsg: string | null;
  children: React.ReactNode;
}

/**
 * Shared loading / error shell for a resource page. Each resource component
 * owns its own data-fetching hook and wraps its content with this so the
 * spinner/error banner treatment stays consistent without KuberneterWorkspace
 * having to know about every resource's query state.
 */
export const ResourceView: React.FC<ResourceViewProps> = ({ isLoading, errorMsg, children }) => {
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2 p-8 select-none">
        <Loader2 className="size-6 text-accent animate-spin" />
        <p className="text-[10px] text-zinc-500">Querying live Kubernetes cluster resources...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="shrink-0 flex items-start gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs leading-5">
        <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
        <div className="font-semibold break-all">
          <p>Error running kubectl command:</p>
          <p className="font-normal text-zinc-400 mt-1 font-mono text-[10px] bg-black/20 p-2 rounded border border-border-dark/30">
            {errorMsg}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
