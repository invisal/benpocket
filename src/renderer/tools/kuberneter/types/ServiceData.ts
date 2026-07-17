export interface ServiceEndpointSlice {
  name: string;
  endpointsCount: string; // e.g. "2/2"
  ports: string;
  addressType: string;
  age: string;
}

export interface ServiceEndpoint {
  name: string;
  endpoints: string; // e.g. "10.244.1.4:4000, 10.244.1.6:4000"
}

export interface ServiceData {
  id: string; // ns/name
  name: string;
  ns: string;
  type: string;
  clusterIp: string;
  clusterIps: string[];
  ipFamilies: string[];
  ipFamilyPolicy: string;
  externalIps: string; // comma-separated or "-"
  selector?: Record<string, string>;
  selectorStr: string; // e.g. "app=darang-server"
  ports: string;
  sessionAffinity: string;
  age: string;
  createdTime: string;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
  controlledByName?: string;
  controlledByKind?: string;
  finalizers?: string[];
  status: string; // "Active"
  hasWarning: boolean;
  endpointSlices: ServiceEndpointSlice[];
  endpoints: ServiceEndpoint[];
}
