import { formatAge } from '../../../utils/formatAge';
import { type ConfigMapData } from '../../../types/ConfigMapData';
import { type SecretData } from '../../../types/SecretData';
import { type ServiceAccountData } from '../../../types/ServiceAccountData';
import { type ResourceQuotaData } from '../../../types/ResourceQuotaData';
import { type LimitRangeData, type LimitRangeItem } from '../../../types/LimitRangeData';
import {
  type HorizontalPodAutoscalerData,
  type HpaMetric
} from '../../../types/HorizontalPodAutoscalerData';
import { type PodDisruptionBudgetData } from '../../../types/PodDisruptionBudgetData';
import { type PriorityClassData } from '../../../types/PriorityClassData';
import { type RuntimeClassData } from '../../../types/RuntimeClassData';
import { type LeaseData } from '../../../types/LeaseData';
import {
  type MutatingWebhookConfigurationData,
  type WebhookItem
} from '../../../types/MutatingWebhookConfigurationData';
import { type ValidatingWebhookConfigurationData } from '../../../types/ValidatingWebhookConfigurationData';
import { type K8sResource } from '../../../types/K8sResource';

export function buildConfigMapDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): ConfigMapData {
  const keysList = Object.keys(rawResource?.data || {});
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    keysCount: keysList.length,
    keysList,
    data: rawResource?.data as Record<string, string> | undefined,
    binaryData: rawResource?.binaryData as Record<string, string> | undefined,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    rawItem: rawResource
  };
}

export function buildSecretDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): SecretData {
  const keysList = Object.keys(rawResource?.data || {});
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    type: (rawResource?.type as string) || 'Opaque',
    keysCount: keysList.length,
    keysList,
    data: rawResource?.data as Record<string, string> | undefined,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    rawItem: rawResource
  };
}

export function buildResourceQuotaDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): ResourceQuotaData {
  const rqItem = rawResource as unknown as {
    metadata?: K8sResource['metadata'];
    spec?: { hard?: Record<string, string>; scopes?: string[] };
    status?: { hard?: Record<string, string>; used?: Record<string, string> };
  };

  const specHard = rqItem?.spec?.hard || {};
  const statusHard = rqItem?.status?.hard || {};
  const statusUsed = rqItem?.status?.used || {};

  const resourceKeys = Array.from(new Set([...Object.keys(specHard), ...Object.keys(statusHard)]));

  const quotas = resourceKeys.map((key) => {
    const hardVal = statusHard[key] || specHard[key] || '0';
    const usedVal = statusUsed[key] || '0';
    return {
      resourceName: key,
      used: usedVal,
      hard: hardVal
    };
  });

  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    quotas,
    scopes: rqItem?.spec?.scopes,
    rawItem: rawResource
  };
}

export function buildLimitRangeDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): LimitRangeData {
  const lrItem = rawResource as unknown as {
    metadata?: K8sResource['metadata'];
    spec?: {
      limits?: Array<{
        type: string;
        default?: Record<string, string>;
        defaultRequest?: Record<string, string>;
        max?: Record<string, string>;
        min?: Record<string, string>;
        maxLimitRequestRatio?: Record<string, string>;
      }>;
    };
  };

  const specLimits = lrItem?.spec?.limits || [];
  const limits: LimitRangeItem[] = [];

  specLimits.forEach((limit) => {
    const limitType = limit.type || '';
    const resourceKeys = Array.from(
      new Set([
        ...Object.keys(limit.min || {}),
        ...Object.keys(limit.max || {}),
        ...Object.keys(limit.default || {}),
        ...Object.keys(limit.defaultRequest || {}),
        ...Object.keys(limit.maxLimitRequestRatio || {})
      ])
    );

    resourceKeys.forEach((resKey) => {
      limits.push({
        type: limitType,
        resource: resKey,
        min: limit.min?.[resKey],
        max: limit.max?.[resKey],
        defaultLimit: limit.default?.[resKey],
        defaultRequest: limit.defaultRequest?.[resKey],
        maxLimitRequestRatio: limit.maxLimitRequestRatio?.[resKey]
      });
    });
  });

  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    limits,
    rawItem: rawResource
  };
}

export function buildHorizontalPodAutoscalerDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): HorizontalPodAutoscalerData {
  const hpaItem = rawResource as unknown as {
    metadata?: K8sResource['metadata'];
    spec?: {
      scaleTargetRef?: {
        apiVersion?: string;
        kind?: string;
        name?: string;
      };
      minReplicas?: number;
      maxReplicas?: number;
      targetCPUUtilizationPercentage?: number;
      metrics?: Array<{
        type: string;
        resource?: {
          name: string;
          target?: {
            type: string;
            averageUtilization?: number;
            averageValue?: string;
          };
        };
      }>;
    };
    status?: {
      currentReplicas?: number;
      desiredReplicas?: number;
      currentCPUUtilizationPercentage?: number;
      currentMetrics?: Array<{
        type: string;
        resource?: {
          name: string;
          current?: {
            averageUtilization?: number;
            averageValue?: string;
          };
        };
      }>;
      conditions?: Array<{
        type: string;
        status: string;
        reason?: string;
        message?: string;
      }>;
    };
  };

  const refKind = hpaItem?.spec?.scaleTargetRef?.kind || '';
  const refName = hpaItem?.spec?.scaleTargetRef?.name || '';
  const minPods = hpaItem?.spec?.minReplicas ?? 1;
  const maxPods = hpaItem?.spec?.maxReplicas ?? 1;
  const replicas = hpaItem?.status?.currentReplicas ?? 0;

  const metricsList: HpaMetric[] = [];

  if (hpaItem?.spec?.targetCPUUtilizationPercentage !== undefined) {
    const currentVal =
      hpaItem.status?.currentCPUUtilizationPercentage !== undefined
        ? `${hpaItem.status.currentCPUUtilizationPercentage}%`
        : 'unknown';
    metricsList.push({
      name: 'Resource cpu on Pods',
      current: currentVal,
      target: `${hpaItem.spec.targetCPUUtilizationPercentage}%`
    });
  }

  const specMetrics = hpaItem?.spec?.metrics || [];
  const statusMetrics = hpaItem?.status?.currentMetrics || [];

  specMetrics.forEach((m) => {
    if (m.type === 'Resource' && m.resource) {
      const resName = m.resource.name;

      let targetVal = '—';
      if (m.resource.target) {
        if (m.resource.target.type === 'Utilization') {
          targetVal = `${m.resource.target.averageUtilization || 0}%`;
        } else if (m.resource.target.type === 'AverageValue') {
          targetVal = m.resource.target.averageValue || '0';
        }
      }

      let currentVal = 'unknown';
      const matchingStatus = statusMetrics.find(
        (sm) => sm.type === 'Resource' && sm.resource?.name === resName
      );
      if (matchingStatus && matchingStatus.resource?.current) {
        if (matchingStatus.resource.current.averageUtilization !== undefined) {
          currentVal = `${matchingStatus.resource.current.averageUtilization}%`;
        } else if (matchingStatus.resource.current.averageValue !== undefined) {
          currentVal = matchingStatus.resource.current.averageValue;
        }
      }

      metricsList.push({
        name: `Resource ${resName} on Pods`,
        current: currentVal,
        target: targetVal
      });
    }
  });

  const conditions = hpaItem?.status?.conditions || [];
  const trueCondition = conditions.find((c) => c.status === 'True');
  const statusText = trueCondition ? trueCondition.type : '—';
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    referenceKind: refKind,
    referenceName: refName,
    minPods,
    maxPods,
    replicas,
    statusText,
    metrics: metricsList,
    rawItem: rawResource
  };
}

export function buildPodDisruptionBudgetDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): PodDisruptionBudgetData {
  const pdbItem = rawResource as unknown as {
    metadata?: K8sResource['metadata'];
    spec?: {
      minAvailable?: number | string;
      maxUnavailable?: number | string;
      selector?: {
        matchLabels?: Record<string, string>;
      };
    };
    status?: {
      currentHealthy?: number;
      desiredHealthy?: number;
      disruptionsAllowed?: number;
      expectedPods?: number;
    };
  };

  const minAvailable =
    pdbItem?.spec?.minAvailable !== undefined ? String(pdbItem.spec.minAvailable) : 'N/A';
  const maxUnavailable =
    pdbItem?.spec?.maxUnavailable !== undefined ? String(pdbItem.spec.maxUnavailable) : 'N/A';

  const matchLabels = pdbItem?.spec?.selector?.matchLabels || {};
  const selector =
    Object.entries(matchLabels)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ') || '';

  const currentHealthy = pdbItem?.status?.currentHealthy ?? 0;
  const desiredHealthy = pdbItem?.status?.desiredHealthy ?? 0;
  const disruptionsAllowed = pdbItem?.status?.disruptionsAllowed;
  const expectedPods = pdbItem?.status?.expectedPods;
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    selector,
    minAvailable,
    maxUnavailable,
    currentHealthy,
    desiredHealthy,
    disruptionsAllowed,
    expectedPods,
    rawItem: rawResource
  };
}

export function buildPriorityClassDetailPayload(
  name: string,
  rawResource?: K8sResource
): PriorityClassData {
  const pcItem = rawResource as unknown as {
    metadata?: K8sResource['metadata'];
    value?: number;
    globalDefault?: boolean;
    preemptionPolicy?: string;
    description?: string;
  };

  const value = pcItem?.value ?? 0;
  const globalDefault = pcItem?.globalDefault ?? false;
  const preemptionPolicy = pcItem?.preemptionPolicy || 'PreemptLowerPriority';
  const description = pcItem?.description || '';
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: name,
    name,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    value,
    globalDefault,
    preemptionPolicy,
    description,
    rawItem: rawResource
  };
}

export function buildRuntimeClassDetailPayload(
  name: string,
  rawResource?: K8sResource
): RuntimeClassData {
  const rcItem = rawResource as unknown as {
    metadata?: K8sResource['metadata'];
    handler?: string;
    overhead?: { podFixed?: { cpu?: string; memory?: string } };
    scheduling?: {
      nodeSelector?: Record<string, string>;
      tolerations?: unknown[];
    };
  };

  const handler = rcItem?.handler || '';
  const nodeSelectorMap = rcItem?.scheduling?.nodeSelector || {};
  const nodeSelector =
    Object.entries(nodeSelectorMap)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') || '';
  const tolerationsCount = rcItem?.scheduling?.tolerations?.length ?? 0;
  const overhead = rcItem?.overhead?.podFixed
    ? {
        cpu: rcItem.overhead.podFixed.cpu,
        memory: rcItem.overhead.podFixed.memory
      }
    : undefined;
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: name,
    name,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    handler,
    nodeSelector,
    tolerationsCount,
    overhead,
    scheduling: rcItem?.scheduling,
    rawItem: rawResource
  };
}

export function buildLeaseDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): LeaseData {
  const leaseItem = rawResource as unknown as {
    metadata?: K8sResource['metadata'];
    spec?: {
      holderIdentity?: string;
      leaseDurationSeconds?: number;
      renewTime?: string;
      acquireTime?: string;
      leaseTransitions?: number;
    };
  };

  const holder = leaseItem?.spec?.holderIdentity || '—';
  const durationSeconds = leaseItem?.spec?.leaseDurationSeconds ?? 0;
  const renewTimeRaw = leaseItem?.spec?.renewTime;
  const renewTime = renewTimeRaw ? new Date(renewTimeRaw).toLocaleString() : '—';
  const acquireTimeRaw = leaseItem?.spec?.acquireTime;
  const acquireTime = acquireTimeRaw ? new Date(acquireTimeRaw).toLocaleString() : undefined;
  const transitions = leaseItem?.spec?.leaseTransitions;
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    holder,
    durationSeconds,
    renewTime,
    acquireTime,
    transitions,
    rawItem: rawResource
  };
}

function parseWebhookSelector(sel?: {
  matchExpressions?: Array<{ key: string; operator: string; values?: string[] }>;
  matchLabels?: Record<string, string>;
}): string {
  if (!sel) return '—';
  const exprs = sel.matchExpressions || [];
  const labels = sel.matchLabels || {};
  if (exprs.length === 0 && Object.keys(labels).length === 0) return '—';

  const parts: string[] = [];
  if (exprs.length > 0) {
    parts.push(
      `Match Expressions: ${exprs
        .map((e) => `${e.key} ${e.operator} [${e.values?.join(',') || ''}]`)
        .join(', ')}`
    );
  }
  if (Object.keys(labels).length > 0) {
    parts.push(
      `Match Labels: ${Object.entries(labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`
    );
  }
  return parts.join('; ');
}

export function buildMutatingWebhookDetailPayload(
  name: string,
  rawResource?: K8sResource
): MutatingWebhookConfigurationData {
  const mutatingItem = rawResource as unknown as {
    apiVersion?: string;
    metadata?: K8sResource['metadata'];
    webhooks?: Array<{
      name: string;
      clientConfig?: {
        service?: {
          name: string;
          namespace: string;
          path?: string;
          port?: number;
        };
        url?: string;
      };
      matchPolicy?: string;
      failurePolicy?: string;
      admissionReviewVersions?: string[];
      reinvocationPolicy?: string;
      sideEffects?: string;
      timeoutSeconds?: number;
      namespaceSelector?: {
        matchExpressions?: Array<{ key: string; operator: string; values?: string[] }>;
        matchLabels?: Record<string, string>;
      };
      objectSelector?: {
        matchExpressions?: Array<{ key: string; operator: string; values?: string[] }>;
        matchLabels?: Record<string, string>;
      };
      rules?: Array<{
        apiGroups?: string[];
        apiVersions?: string[];
        operations?: string[];
        resources?: string[];
        scope?: string;
      }>;
    }>;
  };

  const apiVersion = mutatingItem?.apiVersion || 'admissionregistration.k8s.io/v1';
  const rawWebhooks = mutatingItem?.webhooks || [];

  const webhooks: WebhookItem[] = rawWebhooks.map((w) => {
    const clientConfig = {
      name: w.clientConfig?.service?.name,
      namespace: w.clientConfig?.service?.namespace,
      path: w.clientConfig?.service?.path,
      port: w.clientConfig?.service?.port,
      url: w.clientConfig?.url
    };

    const rules = (w.rules || []).map((r) => ({
      apiGroups: r.apiGroups || [],
      apiVersions: r.apiVersions || [],
      operations: r.operations || [],
      resources: r.resources || [],
      scope: r.scope || '*'
    }));

    return {
      name: w.name,
      clientConfig,
      matchPolicy: w.matchPolicy || 'Equivalent',
      failurePolicy: w.failurePolicy || 'Fail',
      admissionReviewVersions: w.admissionReviewVersions || [],
      reinvocationPolicy: w.reinvocationPolicy || 'Never',
      sideEffects: w.sideEffects || 'None',
      timeoutSeconds: w.timeoutSeconds ?? 10,
      namespaceSelector: parseWebhookSelector(w.namespaceSelector),
      objectSelector: parseWebhookSelector(w.objectSelector),
      rules
    };
  });

  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: name,
    name,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    apiVersion,
    webhooksCount: webhooks.length,
    webhooks,
    rawItem: rawResource
  };
}

export function buildValidatingWebhookDetailPayload(
  name: string,
  rawResource?: K8sResource
): ValidatingWebhookConfigurationData {
  const mutatingPayload = buildMutatingWebhookDetailPayload(name, rawResource);
  return {
    ...mutatingPayload
  };
}

export function buildServiceAccountDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): ServiceAccountData {
  const rawSecrets = (rawResource as { secrets?: Array<{ name: string }> })?.secrets || [];
  const rawImagePullSecrets =
    (rawResource as { imagePullSecrets?: Array<{ name: string }> })?.imagePullSecrets || [];
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    secretsCount: rawSecrets.length,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    secrets: rawSecrets.map((s) => s.name || '').filter(Boolean),
    imagePullSecrets: rawImagePullSecrets.map((s) => s.name || '').filter(Boolean),
    rawItem: rawResource
  };
}
