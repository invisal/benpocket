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
}
