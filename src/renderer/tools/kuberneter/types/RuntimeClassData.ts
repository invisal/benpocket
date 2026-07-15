export interface RuntimeClassData {
  id: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  handler: string;
  nodeSelector?: string;
  tolerationsCount: number;
}
