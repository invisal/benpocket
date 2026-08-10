import type React from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { useKuberneterStore } from '../../store/kuberneter.store';

interface ErrorBannerProps {
  error: string;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, className = '' }) => {
  if (!error) return null;

  const lowerErr = error.toLowerCase();
  const isKubectlMissing =
    error.includes('KUBECTL_NOT_FOUND') ||
    lowerErr.includes('kubectl') ||
    lowerErr.includes('enoent') ||
    lowerErr.includes('command not found') ||
    lowerErr.includes('executable file not found') ||
    lowerErr.includes('spawn') ||
    lowerErr.includes('exec plugin');

  if (isKubectlMissing) {
    return (
      <div
        className={`p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs flex items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-amber-400 shrink-0" />
          <span className="leading-relaxed">kubectl CLI executable is required.</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => useKuberneterStore.getState().showKubectlMissingToast(error)}
          className="h-7 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/20 shrink-0"
        >
          <Settings className="size-3 mr-1.5" />
          Configure kubectl
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5 ${className}`}
    >
      <AlertTriangle className="size-4 text-red-400 shrink-0 mt-0.5" />
      <span className="leading-relaxed">{error}</span>
    </div>
  );
};
