export interface ApplicationData {
  id: string;
  instance: string;
  application: string;
  namespace: string;
  managedBy: string;
  version: string;
  age: string;
  status: 'Running' | 'Pending';
  kind: string;
  creationTimestamp: string;
}
