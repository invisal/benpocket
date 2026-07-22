import { type PodData } from '../../../../types/PodData';

export interface PodToleration {
  key?: string;
  operator?: string;
  value?: string;
  effect?: string;
  tolerationSeconds?: number;
}

export interface PodVolume {
  name: string;
  defaultMode?: string;
  sourcesCount?: number;
  configMap?: { name: string };
  secret?: { secretName: string };
  persistentVolumeClaim?: { claimName: string };
  emptyDir?: Record<string, unknown>;
  hostPath?: { path: string };
  projected?: { sources?: unknown[] };
}

export interface PodCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface ContainerPort {
  containerPort: number;
  protocol: string;
}

export interface ContainerEnvVar {
  name: string;
  value?: string;
}

export interface ContainerVolumeMount {
  name: string;
  mountPath: string;
  readOnly?: boolean;
}

export interface ContainerResourceRequirement {
  cpu?: string;
  memory?: string;
}

export interface ContainerItem {
  name: string;
  image: string;
  imagePullPolicy: string;
  ports?: ContainerPort[];
  env?: ContainerEnvVar[];
  volumeMounts?: ContainerVolumeMount[];
  resources?: {
    requests?: ContainerResourceRequirement;
    limits?: ContainerResourceRequirement;
  };
}

export interface ContainerStatusItem {
  name: string;
  ready: boolean;
  restartCount: number;
  state?: {
    running?: { startedAt: string };
    waiting?: { reason: string; message?: string };
    terminated?: { exitCode: number; reason: string; startedAt: string; finishedAt: string };
  };
}

export interface PodRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    ownerReferences?: Array<{ kind: string; name: string }>;
  };
  spec?: {
    nodeName?: string;
    serviceAccountName?: string;
    tolerations?: PodToleration[];
    volumes?: PodVolume[];
    containers?: ContainerItem[];
  };
  status?: {
    phase?: string;
    podIP?: string;
    podIPs?: Array<{ ip: string }>;
    qosClass?: string;
    conditions?: PodCondition[];
    containerStatuses?: ContainerStatusItem[];
  };
}

export interface PodDetailProps {
  payload: PodData;
  isTab?: boolean;
}
