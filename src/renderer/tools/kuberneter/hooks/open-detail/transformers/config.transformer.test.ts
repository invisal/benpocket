import { describe, it, expect } from 'vitest';
import {
  buildConfigMapDetailPayload,
  buildSecretDetailPayload,
  buildResourceQuotaDetailPayload,
  buildLimitRangeDetailPayload,
  buildHorizontalPodAutoscalerDetailPayload,
  buildPodDisruptionBudgetDetailPayload,
  buildPriorityClassDetailPayload,
  buildRuntimeClassDetailPayload,
  buildLeaseDetailPayload,
  buildMutatingWebhookDetailPayload,
  buildValidatingWebhookDetailPayload,
  buildServiceAccountDetailPayload
} from './config.transformer';
import { type K8sResource } from '../../../types/K8sResource';

describe('config.transformer', () => {
  it('builds configmap payload correctly', () => {
    const raw: K8sResource = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'my-cm',
        namespace: 'default',
        creationTimestamp: '2026-01-01T00:00:00Z',
        labels: { env: 'prod' }
      },
      data: {
        'config.json': '{"key": "val"}'
      }
    };

    const payload = buildConfigMapDetailPayload('my-cm', 'default', raw);
    expect(payload.id).toBe('default/my-cm');
    expect(payload.name).toBe('my-cm');
    expect(payload.ns).toBe('default');
    expect(payload.keysCount).toBe(1);
    expect(payload.keysList).toEqual(['config.json']);
    expect(payload.data?.['config.json']).toBe('{"key": "val"}');
    expect(payload.labels?.env).toBe('prod');
    expect(payload.rawItem).toBe(raw);
  });

  it('builds secret payload correctly', () => {
    const raw: K8sResource = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'my-secret',
        namespace: 'kube-system'
      },
      type: 'Opaque',
      data: {
        token: 'YWRtaW4='
      }
    };

    const payload = buildSecretDetailPayload('my-secret', 'kube-system', raw);
    expect(payload.id).toBe('kube-system/my-secret');
    expect(payload.type).toBe('Opaque');
    expect(payload.keysCount).toBe(1);
    expect(payload.keysList).toEqual(['token']);
    expect(payload.data?.token).toBe('YWRtaW4=');
  });

  it('builds resourcequota payload correctly', () => {
    const raw = {
      apiVersion: 'v1',
      kind: 'ResourceQuota',
      metadata: { name: 'quota-1', namespace: 'default' },
      spec: {
        hard: { cpu: '4', memory: '8Gi' },
        scopes: ['NotBestEffort']
      },
      status: {
        hard: { cpu: '4', memory: '8Gi' },
        used: { cpu: '1', memory: '2Gi' }
      }
    } as unknown as K8sResource;

    const payload = buildResourceQuotaDetailPayload('quota-1', 'default', raw);
    expect(payload.name).toBe('quota-1');
    expect(payload.quotas.length).toBe(2);
    expect(payload.scopes).toEqual(['NotBestEffort']);
    const cpuQuota = payload.quotas.find((q) => q.resourceName === 'cpu');
    expect(cpuQuota).toEqual({ resourceName: 'cpu', used: '1', hard: '4' });
  });

  it('builds limitrange payload correctly', () => {
    const raw = {
      apiVersion: 'v1',
      kind: 'LimitRange',
      metadata: { name: 'limits-1', namespace: 'default' },
      spec: {
        limits: [
          {
            type: 'Container',
            max: { cpu: '2', memory: '1Gi' },
            min: { cpu: '100m', memory: '128Mi' }
          }
        ]
      }
    } as unknown as K8sResource;

    const payload = buildLimitRangeDetailPayload('limits-1', 'default', raw);
    expect(payload.name).toBe('limits-1');
    expect(payload.limits.length).toBe(2);
    const cpuLimit = payload.limits.find((l) => l.resource === 'cpu');
    expect(cpuLimit).toEqual({
      type: 'Container',
      resource: 'cpu',
      min: '100m',
      max: '2',
      defaultLimit: undefined,
      defaultRequest: undefined,
      maxLimitRequestRatio: undefined
    });
  });

  it('builds hpa payload correctly', () => {
    const raw = {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: { name: 'web-hpa', namespace: 'default' },
      spec: {
        scaleTargetRef: { kind: 'Deployment', name: 'web' },
        minReplicas: 2,
        maxReplicas: 10,
        targetCPUUtilizationPercentage: 80
      },
      status: {
        currentReplicas: 3,
        desiredReplicas: 3,
        currentCPUUtilizationPercentage: 50,
        conditions: [{ type: 'AbleToScale', status: 'True' }]
      }
    } as unknown as K8sResource;

    const payload = buildHorizontalPodAutoscalerDetailPayload('web-hpa', 'default', raw);
    expect(payload.name).toBe('web-hpa');
    expect(payload.referenceKind).toBe('Deployment');
    expect(payload.referenceName).toBe('web');
    expect(payload.minPods).toBe(2);
    expect(payload.maxPods).toBe(10);
    expect(payload.replicas).toBe(3);
    expect(payload.statusText).toBe('AbleToScale');
    expect(payload.metrics).toHaveLength(1);
    expect(payload.metrics[0]).toEqual({
      name: 'Resource cpu on Pods',
      current: '50%',
      target: '80%'
    });
  });

  it('builds pdb payload correctly', () => {
    const raw = {
      apiVersion: 'policy/v1',
      kind: 'PodDisruptionBudget',
      metadata: { name: 'web-pdb', namespace: 'default' },
      spec: {
        minAvailable: 1,
        selector: { matchLabels: { app: 'web' } }
      },
      status: {
        currentHealthy: 3,
        desiredHealthy: 2,
        disruptionsAllowed: 1,
        expectedPods: 3
      }
    } as unknown as K8sResource;

    const payload = buildPodDisruptionBudgetDetailPayload('web-pdb', 'default', raw);
    expect(payload.name).toBe('web-pdb');
    expect(payload.minAvailable).toBe('1');
    expect(payload.selector).toBe('app=web');
    expect(payload.currentHealthy).toBe(3);
    expect(payload.desiredHealthy).toBe(2);
    expect(payload.disruptionsAllowed).toBe(1);
    expect(payload.expectedPods).toBe(3);
  });

  it('builds priorityclass payload correctly', () => {
    const raw = {
      apiVersion: 'scheduling.k8s.io/v1',
      kind: 'PriorityClass',
      metadata: { name: 'high-priority' },
      value: 1000000,
      globalDefault: false,
      preemptionPolicy: 'PreemptLowerPriority',
      description: 'High priority workloads'
    } as unknown as K8sResource;

    const payload = buildPriorityClassDetailPayload('high-priority', raw);
    expect(payload.name).toBe('high-priority');
    expect(payload.value).toBe(1000000);
    expect(payload.globalDefault).toBe(false);
    expect(payload.preemptionPolicy).toBe('PreemptLowerPriority');
    expect(payload.description).toBe('High priority workloads');
  });

  it('builds runtimeclass payload correctly', () => {
    const raw = {
      apiVersion: 'node.k8s.io/v1',
      kind: 'RuntimeClass',
      metadata: { name: 'kata' },
      handler: 'kata-runtime',
      overhead: { podFixed: { cpu: '100m', memory: '128Mi' } },
      scheduling: {
        nodeSelector: { 'kata-enabled': 'true' },
        tolerations: [{ key: 'kata' }]
      }
    } as unknown as K8sResource;

    const payload = buildRuntimeClassDetailPayload('kata', raw);
    expect(payload.name).toBe('kata');
    expect(payload.handler).toBe('kata-runtime');
    expect(payload.overhead).toEqual({ cpu: '100m', memory: '128Mi' });
    expect(payload.nodeSelector).toBe('kata-enabled: true');
    expect(payload.tolerationsCount).toBe(1);
  });

  it('builds lease payload correctly', () => {
    const raw = {
      apiVersion: 'coordination.k8s.io/v1',
      kind: 'Lease',
      metadata: { name: 'node-1', namespace: 'kube-node-lease' },
      spec: {
        holderIdentity: 'node-1',
        leaseDurationSeconds: 40,
        leaseTransitions: 0
      }
    } as unknown as K8sResource;

    const payload = buildLeaseDetailPayload('node-1', 'kube-node-lease', raw);
    expect(payload.name).toBe('node-1');
    expect(payload.holder).toBe('node-1');
    expect(payload.durationSeconds).toBe(40);
    expect(payload.transitions).toBe(0);
  });

  it('builds mutating and validating webhook payloads correctly', () => {
    const raw = {
      apiVersion: 'admissionregistration.k8s.io/v1',
      kind: 'MutatingWebhookConfiguration',
      metadata: { name: 'sidecar-injector' },
      webhooks: [
        {
          name: 'sidecar.k8s.io',
          clientConfig: {
            service: { name: 'webhook-svc', namespace: 'default', path: '/mutate' }
          },
          failurePolicy: 'Fail',
          sideEffects: 'None'
        }
      ]
    } as unknown as K8sResource;

    const mutatingPayload = buildMutatingWebhookDetailPayload('sidecar-injector', raw);
    expect(mutatingPayload.name).toBe('sidecar-injector');
    expect(mutatingPayload.webhooksCount).toBe(1);
    expect(mutatingPayload.webhooks[0].clientConfig.name).toBe('webhook-svc');
    expect(mutatingPayload.webhooks[0].clientConfig.namespace).toBe('default');

    const validatingPayload = buildValidatingWebhookDetailPayload('sidecar-injector', raw);
    expect(validatingPayload.name).toBe('sidecar-injector');
    expect(validatingPayload.webhooksCount).toBe(1);
  });

  it('builds serviceaccount payload correctly', () => {
    const raw = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: { name: 'builder-sa', namespace: 'default' },
      secrets: [{ name: 'builder-token-123' }],
      imagePullSecrets: [{ name: 'docker-registry-secret' }]
    } as unknown as K8sResource;

    const payload = buildServiceAccountDetailPayload('builder-sa', 'default', raw);
    expect(payload.name).toBe('builder-sa');
    expect(payload.secretsCount).toBe(1);
    expect(payload.secrets).toEqual(['builder-token-123']);
    expect(payload.imagePullSecrets).toEqual(['docker-registry-secret']);
  });
});
