import type React from 'react';
import { Loader2 } from 'lucide-react';
import { ErrorBanner } from '../shared/ErrorBanner';

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
      <div className="p-4 max-w-xl">
        <ErrorBanner error={errorMsg} />
      </div>
    );
  }

  return <>{children}</>;
};
