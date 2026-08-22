import { describe, it, expect } from 'vitest';
import { getDetailHeaderTitle, getDetailResourceName } from './detailHeaderTitle';

describe('detailHeaderTitle', () => {
  it('returns formatted name for pod', () => {
    expect(getDetailHeaderTitle('pod', { name: 'nginx-pod' })).toBe('Pod: nginx-pod');
  });

  it('returns formatted name for metadata name', () => {
    expect(getDetailHeaderTitle('deployment', { metadata: { name: 'web-deploy' } })).toBe(
      'Deployment: web-deploy'
    );
  });

  it('handles portforwarding data url or name', () => {
    expect(getDetailResourceName('portforwarding', { url: 'http://localhost:8080' })).toBe(
      'http://localhost:8080'
    );
    expect(getDetailHeaderTitle('portforwarding', { url: 'http://localhost:8080' })).toBe(
      'Port Forward: http://localhost:8080'
    );
  });

  it('falls back to Details when data is empty', () => {
    expect(getDetailHeaderTitle('pod', null)).toBe('Pod: Details');
    expect(getDetailHeaderTitle('namespace', {})).toBe('Namespace: Details');
  });

  it('formats titles for config group resources', () => {
    expect(getDetailHeaderTitle('configmap', { name: 'app-config' })).toBe(
      'Config Map: app-config'
    );
    expect(getDetailHeaderTitle('secret', { name: 'app-secret' })).toBe('Secret: app-secret');
    expect(getDetailHeaderTitle('resourcequota', { name: 'compute-quota' })).toBe(
      'Resource Quota: compute-quota'
    );
    expect(getDetailHeaderTitle('limitrange', { name: 'mem-limits' })).toBe(
      'Limit Range: mem-limits'
    );
    expect(getDetailHeaderTitle('horizontalpodautoscaler', { name: 'frontend-hpa' })).toBe(
      'Horizontal Pod Autoscaler: frontend-hpa'
    );
    expect(getDetailHeaderTitle('hpa', { name: 'frontend-hpa' })).toBe(
      'Horizontal Pod Autoscaler: frontend-hpa'
    );
    expect(getDetailHeaderTitle('poddisruptionbudget', { name: 'api-pdb' })).toBe(
      'Pod Disruption Budget: api-pdb'
    );
    expect(getDetailHeaderTitle('pdb', { name: 'api-pdb' })).toBe('Pod Disruption Budget: api-pdb');
    expect(getDetailHeaderTitle('priorityclass', { name: 'high-priority' })).toBe(
      'Priority Class: high-priority'
    );
    expect(getDetailHeaderTitle('runtimeclass', { name: 'gvisor' })).toBe('Runtime Class: gvisor');
    expect(getDetailHeaderTitle('lease', { name: 'node-1' })).toBe('Lease: node-1');
    expect(getDetailHeaderTitle('mutatingwebhook', { name: 'sidecar-injector' })).toBe(
      'Mutating Webhook: sidecar-injector'
    );
    expect(getDetailHeaderTitle('validatingwebhook', { name: 'policy-checker' })).toBe(
      'Validating Webhook: policy-checker'
    );
  });
});
