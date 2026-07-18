export interface PeerData {
  ipBlock?: {
    cidr: string;
    except?: string[];
  };
  namespaceSelector?: string;
  podSelector?: string;
}

export interface RuleData {
  ports?: string[];
  peers?: PeerData[];
}

export interface NetworkPolicyData {
  id: string; // ns/name
  name: string;
  ns: string;
  policyTypes: string[];
  policyTypesStr: string; // e.g. "Ingress, Egress"
  podSelectorStr: string; // e.g. "role:db"
  ingressRules: RuleData[];
  egressRules: RuleData[];
  hasWarning: boolean;
  warningReason?: string;
  age: string;
  createdTime: string;
  creationTimestamp: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rawItem?: unknown;
}
