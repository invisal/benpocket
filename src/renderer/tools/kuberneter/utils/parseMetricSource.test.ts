import { describe, it, expect } from 'vitest';
import { parseMetricSource } from './parseMetricSource';

describe('parseMetricSource', () => {
  it('parses source with namespace, service, and port', () => {
    expect(parseMetricSource('lens-metrics / prometheus:80')).toEqual({
      namespace: 'lens-metrics',
      service: 'prometheus',
      port: '80',
      extra: undefined
    });

    expect(parseMetricSource('monitoring / prometheus-k8s:9090')).toEqual({
      namespace: 'monitoring',
      service: 'prometheus-k8s',
      port: '9090',
      extra: undefined
    });
  });

  it('parses source without port', () => {
    expect(parseMetricSource('monitoring / prometheus-server')).toEqual({
      namespace: 'monitoring',
      service: 'prometheus-server',
      port: undefined,
      extra: undefined
    });
  });

  it('parses source with extra info in parentheses', () => {
    expect(
      parseMetricSource(
        'kube-system / metrics-server (apis/metrics.k8s.io/v1beta1 — live 3s stream)'
      )
    ).toEqual({
      namespace: 'kube-system',
      service: 'metrics-server',
      port: undefined,
      extra: '(apis/metrics.k8s.io/v1beta1 — live 3s stream)'
    });
  });

  it('parses metrics-server shorthand sources into kube-system / metrics-server', () => {
    expect(
      parseMetricSource('metrics-server (apis/metrics.k8s.io/v1beta1 — live 3s stream)')
    ).toEqual({
      namespace: 'kube-system',
      service: 'metrics-server',
      port: undefined,
      extra: '(apis/metrics.k8s.io/v1beta1 — live 3s stream)'
    });

    expect(parseMetricSource('metrics-server (aggregated across 4 pods)')).toEqual({
      namespace: 'kube-system',
      service: 'metrics-server',
      port: undefined,
      extra: '(aggregated across 4 pods)'
    });

    expect(parseMetricSource('metrics-server')).toEqual({
      namespace: 'kube-system',
      service: 'metrics-server',
      port: undefined,
      extra: undefined
    });
  });

  it('returns null for undefined, empty, or unparseable strings', () => {
    expect(parseMetricSource(undefined)).toBeNull();
    expect(parseMetricSource('')).toBeNull();
    expect(parseMetricSource('invalid-format-string-without-slash-or-metrics-server')).toBeNull();
  });
});
