export type PlatformOS = 'mac' | 'win' | 'linux';

export const INSTALL_GUIDES: Record<
  PlatformOS,
  { title: string; commands: { label: string; cmd: string }[] }
> = {
  mac: {
    title: 'macOS (Homebrew / MacPorts)',
    commands: [
      { label: 'Homebrew', cmd: 'brew install kubernetes-cli' },
      { label: 'MacPorts', cmd: 'sudo port selfupdate && sudo port install kubectl' }
    ]
  },
  win: {
    title: 'Windows (WinGet / Chocolatey / Scoop)',
    commands: [
      { label: 'WinGet', cmd: 'winget install -e --id Kubernetes.kubectl' },
      { label: 'Chocolatey', cmd: 'choco install kubernetes-cli' },
      { label: 'Scoop', cmd: 'scoop install kubectl' }
    ]
  },
  linux: {
    title: 'Linux (Snap / Apt / Direct Binary)',
    commands: [
      { label: 'Snap', cmd: 'sudo snap install kubectl --classic' },
      {
        label: 'Direct Binary (curl)',
        cmd: 'curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && chmod +x kubectl && sudo mv kubectl /usr/local/bin/'
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
