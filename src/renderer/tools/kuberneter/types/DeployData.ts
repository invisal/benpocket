export interface DeployData {
  id: string;
  name: string;
  ns: string;
  ready: string;
  upToDate: number;
  available: number;
  age: string;
  rawAge: string;
  replicas: number;
  status: string;
  hasWarning: boolean;
  strategy: string;
}
