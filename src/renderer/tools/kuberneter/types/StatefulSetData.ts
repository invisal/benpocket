import { type K8sResource } from './K8sResource';
import { type DeployRelatedPod } from './DeployData';

export interface StatefulSetData {
  id: string;
  name: string;
  ns: string;
  ready: string;
  replicas: number;
  age: string;
  rawAge: string;
  hasWarning: boolean;
  createdTime?: string;
  rawItem?: K8sResource;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  selector?: Record<string, string>;
  volumeClaimTemplates?: Array<{ name: string; storage?: string; storageClass?: string }>;
  podsList?: DeployRelatedPod[];
}
