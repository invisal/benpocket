import { type K8sResource } from './K8sResource';

export interface PodDisruptionBudgetData {
  id: string;
  name: string;
  ns: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  selector?: string;
  minAvailable: string;
  maxUnavailable: string;
  currentHealthy: number;
  desiredHealthy: number;
  disruptionsAllowed?: number;
  expectedPods?: number;
  rawItem?: K8sResource;
}
