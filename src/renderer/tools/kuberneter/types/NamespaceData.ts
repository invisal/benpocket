import { type K8sResource } from './K8sResource';
import { type DeployRelatedPod } from './DeployData';

export interface NamespaceData {
  id: string;
  name: string;
  status: string;
  age: string;
  createdTime: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rawItem?: K8sResource;
  podsList?: DeployRelatedPod[];
}
