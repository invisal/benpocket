export interface DaemonSetData {
  id: string;
  name: string;
  ns: string;
  desired: number;
  current: number;
  ready: number;
  upToDate: number;
  available: number;
  nodeSelector: string;
  age: string;
  rawAge: string;
  hasWarning: boolean;
}
