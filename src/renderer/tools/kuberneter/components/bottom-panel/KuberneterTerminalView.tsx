import type React from 'react';
import { KuberneterTerminal } from '../terminal';

interface KuberneterTerminalViewProps {
  /** Stable per-tab id used as the PTY session id. */
  sessionId: string;
  /** Active context name for the cluster this terminal targets. */
  contextName: string;
  /** Kubeconfig path for the active instance ('default' => ambient). */
  kubeconfigPath?: string;
  /** Whether this tab is currently the visible one. */
  isActive: boolean;
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
  isActive
}) => {
  return (
    <KuberneterTerminal
      sessionId={sessionId}
      contextName={contextName}
      kubeconfigPath={kubeconfigPath}
      isActive={isActive}
    />
  );
};
