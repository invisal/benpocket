export interface IngressRuleData {
  host: string;
  path: string;
  link: string;
  serviceName: string;
  servicePort: string;
}

export interface IngressData {
  id: string; // ns/name
  name: string;
  ns: string;
  loadBalancers: string; // comma-separated ips/hosts
  rules: IngressRuleData[];
  rulesStr: string; // http://host/path -> svc:port
  ports: string; // ports list, e.g. "80, 443"
  age: string;
  createdTime: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rawItem?: unknown;
}
