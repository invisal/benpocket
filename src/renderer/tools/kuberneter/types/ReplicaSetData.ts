export interface ReplicaSetData {
  id: string;
  name: string;
  ns: string;
  desired: number;
  current: number;
  ready: number;
  age: string;
  rawAge: string;
  hasWarning: boolean;
}
