import { describe, it, expect } from 'vitest';
import {
  buildServiceDetailPayload,
  buildEndpointSliceDetailPayload,
  buildEndpointDetailPayload,
  buildIngressDetailPayload,
  buildIngressClassDetailPayload,
  buildNetworkPolicyDetailPayload,
  buildPortForwardDetailPayload
} from './network.transformer';
import { type K8sResource } from '../../../types/K8sResource';

describe('network.transformer', () => {
  it('builds service detail payload correctly', () => {
    const rawSvc = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'my-service',
        namespace: 'default',
        creationTimestamp: '2026-01-01T00:00:00Z',
        labels: { app: 'web' }
      },
      spec: {
        type: 'ClusterIP',
        clusterIP: '10.96.0.1',
        ports: [{ port: 80, protocol: 'TCP', targetPort: 8080 }],
        selector: { app: 'web' }
      }
    } as unknown as K8sResource;

    const rawEndpoints = [
      {
        apiVersion: 'v1',
        kind: 'Endpoints',
        metadata: { name: 'my-service', namespace: 'default' },
        subsets: [
          {
            addresses: [{ ip: '10.244.0.5' }],
            ports: [{ port: 8080 }]
          }
        ]
      }
    ] as unknown as K8sResource[];

    const rawSlices = [
      {
        apiVersion: 'discovery.k8s.io/v1',
        kind: 'EndpointSlice',
        metadata: {
          name: 'my-service-slice1',
          namespace: 'default',
          labels: { 'kubernetes.io/service-name': 'my-service' },
          creationTimestamp: '2026-01-01T00:00:00Z'
        },
        addressType: 'IPv4',
        endpoints: [{ conditions: { ready: true } }],
        ports: [{ port: 80, protocol: 'TCP' }]
      }
    ] as unknown as K8sResource[];

    const payload = buildServiceDetailPayload(
      'my-service',
      'default',
      rawSvc,
      rawEndpoints,
      rawSlices
    );

    expect(payload.id).toBe('default/my-service');
    expect(payload.name).toBe('my-service');
    expect(payload.ns).toBe('default');
    expect(payload.clusterIp).toBe('10.96.0.1');
    expect(payload.ports).toBe('80:8080/TCP');
    expect(payload.selectorStr).toBe('app=web');
    expect(payload.endpoints.length).toBe(1);
    expect(payload.endpoints[0].endpoints).toBe('10.244.0.5:8080');
    expect(payload.endpointSlices.length).toBe(1);
    expect(payload.endpointSlices[0].name).toBe('my-service-slice1');
    expect(payload.endpointSlices[0].endpointsCount).toBe('1/1');
  });

  it('builds endpointslice payload correctly', () => {
    const rawSlice = {
      apiVersion: 'discovery.k8s.io/v1',
      kind: 'EndpointSlice',
      metadata: {
        name: 'my-slice',
        namespace: 'default',
        labels: { 'kubernetes.io/service-name': 'web-svc' },
        ownerReferences: [{ kind: 'Service', name: 'web-svc' }]
      },
      addressType: 'IPv4',
      endpoints: [
        {
          addresses: ['10.244.0.10'],
          conditions: { ready: true },
          targetRef: { kind: 'Pod', name: 'web-pod-1', namespace: 'default' },
          nodeName: 'node-1'
        }
      ],
      ports: [{ name: 'http', port: 80, protocol: 'TCP' }]
    } as unknown as K8sResource;

    const payload = buildEndpointSliceDetailPayload('my-slice', 'default', rawSlice);
    expect(payload.id).toBe('default/my-slice');
    expect(payload.name).toBe('my-slice');
    expect(payload.controlledByName).toBe('web-svc');
    expect(payload.controlledByKind).toBe('Service');
    expect(payload.endpoints.length).toBe(1);
    expect(payload.endpoints[0].targetRefName).toBe('web-pod-1');
    expect(payload.endpoints[0].nodeName).toBe('node-1');
    expect(payload.ports.length).toBe(1);
    expect(payload.portsStr).toBe('80/TCP');
  });

  it('builds endpoint payload correctly', () => {
    const rawEp = {
      apiVersion: 'v1',
      kind: 'Endpoints',
      metadata: {
        name: 'my-ep',
        namespace: 'default'
      },
      subsets: [
        {
          addresses: [
            {
              ip: '10.244.1.2',
              targetRef: { kind: 'Pod', name: 'api-pod-1', namespace: 'default' }
            }
          ],
          ports: [{ name: 'http', port: 3000, protocol: 'TCP' }]
        }
      ]
    } as unknown as K8sResource;

    const payload = buildEndpointDetailPayload('my-ep', 'default', rawEp);
    expect(payload.id).toBe('default/my-ep');
    expect(payload.endpointsStr).toBe('10.244.1.2:3000');
    expect(payload.subsets.length).toBe(1);
    expect(payload.subsets[0].addresses?.[0].targetRefName).toBe('api-pod-1');
  });

  it('builds ingress payload correctly', () => {
    const rawIng = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'my-ingress',
        namespace: 'default'
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/api',
                  backend: {
                    service: { name: 'api-svc', port: { number: 80 } }
                  }
                }
              ]
            }
          }
        ]
      }
    } as unknown as K8sResource;

    const payload = buildIngressDetailPayload('my-ingress', 'default', rawIng);
    expect(payload.id).toBe('default/my-ingress');
    expect(payload.rules.length).toBe(1);
    expect(payload.rules[0].host).toBe('example.com');
    expect(payload.rules[0].path).toBe('/api');
    expect(payload.rules[0].serviceName).toBe('api-svc');
    expect(payload.rules[0].servicePort).toBe('80');
  });

  it('builds ingress class payload correctly', () => {
    const rawIc = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'IngressClass',
      metadata: {
        name: 'nginx-class',
        annotations: { 'ingressclass.kubernetes.io/is-default-class': 'true' }
      },
      spec: {
        controller: 'k8s.io/ingress-nginx',
        parameters: {
          name: 'nginx-params',
          kind: 'IngressParameters',
          scope: 'Cluster'
        }
      }
    } as unknown as K8sResource;

    const payload = buildIngressClassDetailPayload('nginx-class', rawIc);
    expect(payload.id).toBe('nginx-class');
    expect(payload.isDefault).toBe(true);
    expect(payload.controller).toBe('k8s.io/ingress-nginx');
    expect(payload.parametersName).toBe('nginx-params');
    expect(payload.parametersKind).toBe('IngressParameters');
  });

  it('builds network policy payload correctly', () => {
    const rawNp = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: 'db-policy',
        namespace: 'prod'
      },
      spec: {
        podSelector: { matchLabels: { app: 'db' } },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          {
            ports: [{ port: 5432, protocol: 'TCP' }],
            from: [{ podSelector: { matchLabels: { role: 'backend' } } }]
          }
        ],
        egress: [{ to: [{ ipBlock: { cidr: '10.0.0.0/16' } }] }]
      }
    } as unknown as K8sResource;

    const payload = buildNetworkPolicyDetailPayload('db-policy', 'prod', rawNp);
    expect(payload.id).toBe('prod/db-policy');
    expect(payload.podSelectorStr).toBe('app=db');
    expect(payload.policyTypes).toEqual(['Ingress', 'Egress']);
    expect(payload.ingressRules.length).toBe(1);
    expect(payload.ingressRules[0].ports).toEqual(['5432/TCP']);
    expect(payload.ingressRules[0].peers?.[0].podSelector).toBe('role=backend');
    expect(payload.egressRules.length).toBe(1);
    expect(payload.egressRules[0].peers?.[0].ipBlock?.cidr).toBe('10.0.0.0/16');
  });

  it('builds port forward payload correctly', () => {
    const rawPf = {
      id: 'pf-1',
      name: 'my-pod',
      ns: 'default',
      kind: 'Pod',
      podPort: 80,
      localPort: 8080,
      protocol: 'TCP',
      status: 'Active' as const,
      url: 'http://localhost:8080'
    };

    const payload = buildPortForwardDetailPayload(rawPf);
    expect(payload.id).toBe('pf-1');
    expect(payload.kind).toBe('Pod');
    expect(payload.localPort).toBe(8080);
    expect(payload.status).toBe('Active');
  });
});
