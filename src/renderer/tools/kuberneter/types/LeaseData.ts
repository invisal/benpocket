export interface LeaseData {
  id: string; // namespace/name
  name: string;
  ns: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime: string;
  holder: string; // spec.holderIdentity
  durationSeconds: number; // spec.leaseDurationSeconds
  renewTime: string; // spec.renewTime
}
