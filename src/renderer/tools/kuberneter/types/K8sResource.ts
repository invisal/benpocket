export interface K8sResource {
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  status?: {
    phase?: string;
    containerStatuses?: { restartCount?: number }[];
    replicas?: number;
    readyReplicas?: number;
    updatedReplicas?: number;
    availableReplicas?: number;
    desiredNumberScheduled?: number;
    currentNumberScheduled?: number;
    updatedNumberScheduled?: number;
    numberReady?: number;
    numberAvailable?: number;
    conditions?: { type?: string; status?: string; message?: string }[];
    nodeInfo?: { kubeletVersion?: string };
    capacity?: { cpu?: string; memory?: string };
    allocatable?: { cpu?: string; memory?: string };
  };
  spec?: {
    type?: string;
    clusterIP?: string;
    ports?: { port?: number; protocol?: string }[];
    taints?: { key?: string; effect?: string }[];
    replicas?: number;
    strategy?: {
      type?: string;
    };
    template?: {
      spec?: {
        nodeSelector?: Record<string, string>;
      };
    };
  };
  data?: Record<string, unknown>;
}
