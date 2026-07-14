export interface SecretData {
  id: string;
  name: string;
  ns: string;
  type: string;
  keysCount: number;
  keysList: string[];
  data?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
}
