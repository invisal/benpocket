export type PortForwardTunnelType = 'none' | 'cloudflare' | 'ngrok';

export interface PortForwardData {
  id: string;
  name: string;
  ns: string;
  kind: string;
  podPort: number;
  localPort: number;
  protocol: string;
  tunnelType?: PortForwardTunnelType;
  publicUrl?: string;
  status: 'Active' | 'Stopped' | 'Error';
  url: string;
  pid?: number;
}
