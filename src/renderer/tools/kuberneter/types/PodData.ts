export interface PodContainer {
  name: string;
  ready: boolean;
}

export interface PodData {
  id: string;
  name: string;
  ns: string;
  status: string;
  restarts: number;
  age: string;
  rawAge: string;
  cpu: string;
  memory: string;
  containers: PodContainer[];
  controlledBy: string;
  node: string;
  qos: string;
  hasWarning: boolean;
}
