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
});
