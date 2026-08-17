export interface K8sResource {
  kind?: string;
  apiVersion?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    uid?: string;
    ownerReferences?: Array<{
      kind?: string;
      name?: string;
      apiVersion?: string;
      uid?: string;
      controller?: boolean;
      blockOwnerDeletion?: boolean;
    }>;
  };
  status?: {
    phase?: string;
    containerStatuses?: Array<{
      name?: string;
      ready?: boolean;
      restartCount?: number;
      image?: string;
      state?: unknown;
    }>;
    replicas?: number;
    readyReplicas?: number;
    updatedReplicas?: number;
    availableReplicas?: number;
    unavailableReplicas?: number;
    desiredNumberScheduled?: number;
    currentNumberScheduled?: number;
    updatedNumberScheduled?: number;
    numberReady?: number;
    numberAvailable?: number;
    numberMisscheduled?: number;
    succeeded?: number;
    failed?: number;
    active?: number;
    completionTime?: string;
    startTime?: string;
    lastScheduleTime?: string;
    lastSuccessfulTime?: string;
    conditions?: Array<{
      type?: string;
      status?: string;
      message?: string;
      reason?: string;
      lastTransitionTime?: string;
    }>;
    nodeInfo?: { kubeletVersion?: string };
    capacity?: { cpu?: string; memory?: string };
    allocatable?: { cpu?: string; memory?: string };
  };
  spec?: {
    type?: string;
    clusterIP?: string;
    ports?: Array<{
      port?: number;
      protocol?: string;
      name?: string;
      targetPort?: number | string;
    }>;
    taints?: Array<{ key?: string; effect?: string; value?: string }>;
    replicas?: number;
    completions?: number;
    parallelism?: number;
    backoffLimit?: number;
    schedule?: string;
    suspend?: boolean;
    timeZone?: string;
    serviceName?: string;
    nodeName?: string;
    selector?: {
      matchLabels?: Record<string, string>;
      matchExpressions?: unknown[];
    };
    strategy?: {
      type?: string;
    };
    volumeClaimTemplates?: Array<{
      metadata?: { name?: string; labels?: Record<string, string> };
      spec?: {
        accessModes?: string[];
        resources?: { requests?: { storage?: string } };
        storageClassName?: string;
      };
    }>;
    template?: {
      metadata?: {
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
      };
      spec?: {
        nodeSelector?: Record<string, string>;
        nodeName?: string;
        serviceAccountName?: string;
        containers?: Array<{
          name: string;
          image?: string;
          ports?: Array<{ containerPort?: number; protocol?: string; name?: string }>;
          resources?: {
            requests?: { cpu?: string; memory?: string };
            limits?: { cpu?: string; memory?: string };
          };
        }>;
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
