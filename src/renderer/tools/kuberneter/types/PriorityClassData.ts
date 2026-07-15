export interface PriorityClassData {
  id: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime?: string;
  value: number;
  globalDefault: boolean;
  description?: string;
}
