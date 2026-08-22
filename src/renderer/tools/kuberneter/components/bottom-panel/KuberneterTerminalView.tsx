import type React from 'react';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const KuberneterTerminal = lazy(() =>
  import('../terminal/KuberneterTerminal').then((m) => ({
    default: m.KuberneterTerminal
  }))
);

interface KuberneterTerminalViewProps {
  /** Stable per-tab id used as the PTY session id. */
  sessionId: string;
  /** Active context name for the cluster this terminal targets. */
  contextName: string;
  /** Kubeconfig path for the active instance ('default' => ambient). */
  kubeconfigPath?: string;
  /** Whether this tab is currently the visible one. */
  isActive: boolean;
  /** Optional shell command to run on terminal initialization. */
  initialCommand?: string;
}

/**
 * Panel-facing wrapper for the Kuberneter terminal. The real xterm.js + PTY
 * implementation lives in components/terminal; this adapter just maps the
 * bottom-panel tab props onto it.
 */
export const KuberneterTerminalView: React.FC<KuberneterTerminalViewProps> = ({
  sessionId,
  contextName,
  kubeconfigPath,
  isActive,
  initialCommand
}) => {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-surface-1 text-xs text-muted-foreground font-mono gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span>Initializing terminal...</span>
        </div>
      }
    >
      <KuberneterTerminal
        sessionId={sessionId}
        contextName={contextName}
        kubeconfigPath={kubeconfigPath}
        isActive={isActive}
        initialCommand={initialCommand}
      />
    </Suspense>
  );
};
