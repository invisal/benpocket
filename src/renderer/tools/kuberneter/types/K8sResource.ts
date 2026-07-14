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
    succeeded?: number;
    failed?: number;
    active?: number;
    completionTime?: string;
    lastScheduleTime?: string;
    lastSuccessfulTime?: string;
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
    completions?: number;
    parallelism?: number;
    schedule?: string;
    suspend?: boolean;
    timeZone?: string;
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
  binaryData?: Record<string, string>;
  // Kubernetes Event fields (core/v1 Event)
  type?: string;
  message?: string;
  reason?: string;
  count?: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  source?: {
    component?: string;
    host?: string;
  };
  involvedObject?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
}
