import { type K8sResource } from './K8sResource';

export interface RuntimeClassData {
  id: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  handler: string;
  nodeSelector?: string;
  tolerationsCount: number;
  overhead?: { cpu?: string; memory?: string };
  scheduling?: { nodeSelector?: Record<string, string>; tolerations?: unknown[] };
  rawItem?: K8sResource;
}
