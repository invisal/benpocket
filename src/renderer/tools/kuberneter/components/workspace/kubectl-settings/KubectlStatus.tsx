import { CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import type { KubectlCheckResult } from '../../../../../../preload/kuberneter/api';
import { SectionLabel } from './SectionLabel';

interface KubectlStatusProps {
  loading: boolean;
  checkResult: KubectlCheckResult | null;
  inputPath: string;
  onRunCheck: (pathToCheck?: string) => void;
}

export function KubectlStatus({ loading, checkResult, inputPath, onRunCheck }: KubectlStatusProps) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>kubectl Status</SectionLabel>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <Loader2 className="size-4 animate-spin text-accent" />
              <span>Checking executable...</span>
            </div>
          ) : checkResult?.available ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="size-3.5" />
              kubectl {checkResult.version ?? 'Available'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              <XCircle className="size-3.5" />
              Not Found
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRunCheck(inputPath)}
          disabled={loading}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          title="Re-test executable"
        >
          <RefreshCw className={`size-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Re-test
        </Button>
      </div>

      {!loading && !checkResult?.available && (
        <p className="text-red-400/90 text-xs leading-relaxed pt-1">
          {checkResult?.error ||
            'The kubectl binary was not found on system $PATH or at the specified location.'}
        </p>
      )}
    </div>
  );
}
