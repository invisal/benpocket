import { type K8sResource } from './K8sResource';

export interface SecretData {
  id: string;
  name: string;
  ns: string;
  type: string;
  keysCount: number;
  keysList: string[];
  data?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  creationTimestamp?: string;
  rawItem?: K8sResource;
}
