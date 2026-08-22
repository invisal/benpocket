export type TunnelProvider = 'none' | 'cloudflare' | 'ngrok';

export interface StartTunnelParams {
  id: string;
  provider: TunnelProvider;
  localPort: number;
  protocol?: string;
}

export interface TunnelResult {
  success: boolean;
  provider: TunnelProvider;
  publicUrl?: string;
  error?: string;
}
