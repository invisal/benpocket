export interface EndpointSliceEndpoint {
  addresses: string[];
  ready?: boolean;
  targetRefName?: string;
  targetRefNamespace?: string;
  targetRefKind?: string;
  nodeName?: string;
  zone?: string;
}

export interface EndpointSlicePort {
  name?: string;
  port?: number;
  protocol?: string;
  appProtocol?: string;
}

export interface EndpointSliceData {
  id: string; // ns/name
  name: string;
  ns: string;
  addressType: string;
  endpoints: EndpointSliceEndpoint[];
  endpointsStr: string; // IP:Port lists
  ports: EndpointSlicePort[];
  portsStr: string; // e.g. "4000/TCP"
  age: string;
  createdTime: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  controlledByName?: string;
  controlledByKind?: string;
  rawItem?: unknown;
}
