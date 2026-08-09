import type React from 'react';
import { Package, ExternalLink, Terminal, Settings } from 'lucide-react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';

function getPlatformInstallInfo(): { command: string; label: string } {
  // process.platform is available in Electron renderer via contextBridge / window.process
  // Fallback to navigator.userAgent if not available.
  const platform =
    typeof window !== 'undefined' &&
    (window as { process?: { platform?: string } }).process?.platform
      ? (window as { process?: { platform?: string } }).process!.platform!
      : navigator.userAgent.toLowerCase().includes('win')
        ? 'win32'
        : navigator.userAgent.toLowerCase().includes('linux')
          ? 'linux'
          : 'darwin';

  if (platform === 'win32') {
    return { command: 'choco install kubernetes-helm', label: 'Windows (Chocolatey)' };
  }
  if (platform === 'linux') {
    return { command: 'sudo snap install helm --classic', label: 'Linux (Snap)' };
  }
  // macOS
  return { command: 'brew install helm', label: 'macOS (Homebrew)' };
}

export const HelmNotInstalled: React.FC = () => {
  const { command, label } = getPlatformInstallInfo();

  const openInstallDocs = (): void => {
    window.open('https://helm.sh/docs/intro/install/', '_blank');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-10 select-none bg-dotted">
      {/* Icon tile */}
      <div className="mb-5 flex items-center justify-center size-16 rounded-2xl bg-surface-2 border border-border shadow-sm">
        <Package className="size-8 text-muted-foreground" />
      </div>

      {/* Heading */}
      <h2 className="text-base font-semibold text-foreground mb-1">Helm is not installed</h2>
      <p className="text-xs text-muted-foreground text-center max-w-sm mb-6 leading-5">
        Helm is required to manage releases and browse chart repositories. Configure its path in
        Settings or install it on your system.
      </p>

      {/* Platform install command */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex items-center gap-1.5 mb-2">
          <Terminal className="size-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-black/30 border border-border rounded-lg px-3 py-2.5">
          <code className="flex-1 text-xs font-mono text-foreground break-all">{command}</code>
          <button
            className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border hover:border-border-dark"
            onClick={() => {
              void navigator.clipboard.writeText(command);
            }}
            title="Copy to clipboard"
          >
            Copy
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Other install methods available on the Helm website.
        </p>
      </div>

      {/* CTA buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            const activeInstanceId = useLayoutStore.getState().activeInstanceId;
            useKuberneterStore
              .getState()
              .setKuberneterInstanceResource(activeInstanceId, 'settings');
            useLayoutStore.getState().openTab({
              id: `kuberneter-k8s-settings-${activeInstanceId}`,
              title: 'Settings',
              type: 'kuberneter',
              instanceId: activeInstanceId,
              meta: { resource: 'settings' }
            });
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-emphasis-text text-xs font-semibold hover:brightness-105 transition-colors cursor-pointer"
        >
          <Settings className="size-3.5" />
          Configure Helm in Settings
        </button>

        <button
          onClick={openInstallDocs}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border hover:border-border-dark text-xs font-medium text-foreground transition-colors cursor-pointer"
        >
          <ExternalLink className="size-3.5" />
          View Install Instructions
        </button>
      </div>
    </div>
  );
};
