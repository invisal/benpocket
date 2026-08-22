import { type K8sResource } from './K8sResource';
import { type DeployRelatedPod } from './DeployData';

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
  createdTime?: string;
  rawItem?: K8sResource;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  selector?: Record<string, string>;
  podsList?: DeployRelatedPod[];
}
