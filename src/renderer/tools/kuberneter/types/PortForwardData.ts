export interface PortForwardData {
  id: string;
  name: string;
  ns: string;
  kind: string;
  podPort: number;
  localPort: number;
  protocol: string;
  status: 'Active' | 'Stopped' | 'Error';
  url: string;
  pid?: number;
}
