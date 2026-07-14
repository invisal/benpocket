export interface HpaMetric {
  name: string;
  current: string;
  target: string;
}

export interface HorizontalPodAutoscalerData {
  id: string;
  name: string;
  ns: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  referenceKind: string;
  referenceName: string;
  minPods: number;
  maxPods: number;
  replicas: number;
  statusText: string;
  metrics: HpaMetric[];
}
