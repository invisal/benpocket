export type PlatformOS = 'mac' | 'win' | 'linux';

export const HELM_INSTALL_GUIDES: Record<
  PlatformOS,
  { title: string; commands: { label: string; cmd: string }[] }
> = {
  mac: {
    title: 'macOS (Homebrew / MacPorts)',
    commands: [
      { label: 'Homebrew', cmd: 'brew install helm' },
      { label: 'MacPorts', cmd: 'sudo port install helm' }
    ]
  },
  win: {
    title: 'Windows (WinGet / Chocolatey / Scoop)',
    commands: [
      { label: 'WinGet', cmd: 'winget install Helm.Helm' },
      { label: 'Chocolatey', cmd: 'choco install kubernetes-helm' },
      { label: 'Scoop', cmd: 'scoop install helm' }
    ]
  },
  linux: {
    title: 'Linux (Snap / Official Script)',
    commands: [
      { label: 'Snap', cmd: 'sudo snap install helm --classic' },
      {
        label: 'Official Script',
        cmd: 'curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash'
      }
    ]
  }
};

export const OS_NAMES: Record<PlatformOS, string> = {
  mac: 'macOS',
  win: 'Windows',
  linux: 'Linux'
};

export function getDetectedOS(): PlatformOS {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    if (ua.includes('win') || platform.includes('win')) return 'win';
    if (ua.includes('linux') || platform.includes('linux')) return 'linux';
    if (ua.includes('mac') || platform.includes('mac')) return 'mac';
  }
  return 'mac';
}
