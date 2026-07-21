export interface NodeCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface NodeResource {
  metadata?: {
    name?: string;
    labels?: Record<string, string>;
  };
  status?: {
    conditions?: NodeCondition[];
    capacity?: {
      cpu?: string;
      memory?: string;
      pods?: string;
    };
    allocatable?: {
      cpu?: string;
      memory?: string;
      pods?: string;
    };
    nodeInfo?: {
      kubeletVersion?: string;
      osImage?: string;
      architecture?: string;
      kernelVersion?: string;
      containerRuntimeVersion?: string;
    };
  };
}

export interface PodResource {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  status?: {
    phase?: string;
  };
  spec?: {
    containers?: {
      resources?: {
        requests?: {
          cpu?: string;
          memory?: string;
        };
        limits?: {
          cpu?: string;
          memory?: string;
        };
      };
    }[];
  };
}

export interface NodeMetric {
  name: string;
  cpu: string;
  cpuPct: string;
  memory: string;
  memoryPct: string;
}

export interface EventResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
  involvedObject?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
  source?: {
    component?: string;
  };
  type?: string;
  reason?: string;
  message?: string;
  lastTimestamp?: string;
  firstTimestamp?: string;
  count?: number;
}
