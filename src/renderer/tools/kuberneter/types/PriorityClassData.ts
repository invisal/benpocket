import { type K8sResource } from './K8sResource';

export interface PriorityClassData {
  id: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  value: number;
  globalDefault: boolean;
  preemptionPolicy?: string;
  description?: string;
  rawItem?: K8sResource;
}
