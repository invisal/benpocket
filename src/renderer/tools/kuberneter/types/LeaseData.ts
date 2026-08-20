import { type K8sResource } from './K8sResource';

export interface LeaseData {
  id: string; // namespace/name
  name: string;
  ns: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime: string;
  holder: string; // spec.holderIdentity
  durationSeconds: number; // spec.leaseDurationSeconds
  renewTime: string; // spec.renewTime
  acquireTime?: string; // spec.acquireTime
  transitions?: number; // spec.leaseTransitions
  rawItem?: K8sResource;
}
