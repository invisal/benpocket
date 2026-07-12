export interface NodeData {
  id: string;
  name: string;
  hasWarning: boolean;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  taints: number;
  roles: string;
  version: string;
  age: string;
  conditions: string;
  cpuCapacity: string;
  memoryCapacity: string;
  diskCapacity: string;
  rawCpu: string;
  rawMemory: string;
  rawDisk: string;
  rawAge: string;
  rawConditions: string;
}
