import { type K8sResource } from './K8sResource';

export interface QuotaItem {
  resourceName: string;
  used: string;
  hard: string;
}

export interface ResourceQuotaData {
  id: string;
  name: string;
  ns: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  quotas: QuotaItem[];
  scopes?: string[];
  rawItem?: K8sResource;
}
