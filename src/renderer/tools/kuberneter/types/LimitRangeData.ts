export interface LimitRangeItem {
  type: string;
  resource: string;
  min?: string;
  max?: string;
  defaultLimit?: string;
  defaultRequest?: string;
  maxLimitRequestRatio?: string;
}

export interface LimitRangeData {
  id: string;
  name: string;
  ns: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  limits: LimitRangeItem[];
}
