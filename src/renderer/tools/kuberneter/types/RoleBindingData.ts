import { type K8sResource } from './K8sResource';

export interface Subject {
  kind: string;
  name: string;
  namespace?: string;
  apiGroup?: string;
}

export interface RoleRef {
  kind: string;
  name: string;
  apiGroup: string;
}

export interface RoleBindingData {
  id: string;
  name: string;
  ns: string;
  age: string;
  createdTime: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  roleRef?: RoleRef;
  subjects?: Subject[];
  rawItem?: K8sResource;
}
