export interface IngressClassData {
  id: string; // name (cluster-scoped)
  name: string;
  isDefault: boolean; // annotation: ingressclass.kubernetes.io/is-default-class === 'true'
  controller: string;
  parametersName: string;
  parametersScope: string; // e.g. 'Cluster'
  parametersKind: string; // e.g. 'IngressParameters'
  parametersApiGroup: string; // e.g. 'k8s.example.com'
  age: string;
  createdTime: string;
  annotations?: Record<string, string>;
  rawItem?: unknown;
}
