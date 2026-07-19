import { type K8sResource } from './K8sResource';

export interface StorageClassPVInfo {
  name: string;
  capacity: string;
  status: string;
}

export interface StorageClassData {
  id: string;
  name: string;
  provisioner: string;
  reclaimPolicy: string;
  isDefault: boolean;
  volumeBindingMode: string;
  age: string;
  createdTime: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  pvs: StorageClassPVInfo[];
  rawItem?: K8sResource;
}
