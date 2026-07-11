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
    numberReady?: number;
  };
  spec?: {
    type?: string;
    clusterIP?: string;
    ports?: { port?: number; protocol?: string }[];
  };
  data?: Record<string, unknown>;
}
