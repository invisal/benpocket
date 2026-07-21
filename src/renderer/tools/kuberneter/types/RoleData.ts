import { type K8sResource } from './K8sResource';

export interface RoleRule {
  apiGroups?: string[];
  resources?: string[];
  resourceNames?: string[];
  verbs: string[];
  nonResourceURLs?: string[];
}

export interface RoleData {
  id: string;
  name: string;
  ns: string;
  age: string;
  createdTime: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rules?: RoleRule[];
  rawItem?: K8sResource;
}
