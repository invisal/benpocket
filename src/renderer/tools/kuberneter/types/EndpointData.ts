export interface EndpointAddress {
  ip: string;
  hostname?: string;
  targetRefName?: string;
  targetRefNamespace?: string;
  targetRefKind?: string;
  nodeName?: string;
}

export interface EndpointPort {
  name?: string;
  port?: number;
  protocol?: string;
}

export interface EndpointSubset {
  addresses?: EndpointAddress[];
  notReadyAddresses?: EndpointAddress[];
  ports?: EndpointPort[];
}

export interface EndpointData {
  id: string; // ns/name
  name: string;
  ns: string;
  endpointsStr: string; // formatted list of IP:port
  subsets: EndpointSubset[];
  age: string;
  createdTime: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rawItem?: unknown;
}
