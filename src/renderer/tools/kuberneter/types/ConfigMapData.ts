import { type K8sResource } from './K8sResource';

export interface ConfigMapData {
  id: string;
  name: string;
  ns: string;
  keysCount: number;
  keysList: string[];
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  rawItem?: K8sResource;
}
