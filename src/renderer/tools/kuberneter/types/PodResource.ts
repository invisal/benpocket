export interface ContainerState {
  waiting?: {
    reason?: string;
    message?: string;
  };
  running?: {
    startedAt?: string;
  };
  terminated?: {
    exitCode: number;
    reason?: string;
    message?: string;
  };
}

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state?: ContainerState;
}

export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
  blockOwnerDeletion?: boolean;
}

export interface PodResource {
  kind?: 'Pod';
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    ownerReferences?: OwnerReference[];
  };
  spec?: {
    nodeName?: string;
    containers?: {
      name: string;
      image?: string;
    }[];
  };
  status?: {
    phase?: string;
    qosClass?: string;
    hostIP?: string;
    podIP?: string;
    startTime?: string;
    containerStatuses?: ContainerStatus[];
    initContainerStatuses?: ContainerStatus[];
  };
}
