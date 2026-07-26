export type MetricsSource = 'auto' | 'prometheus' | 'metrics-server' | 'none';
export type PrometheusProvider =
  'auto' | 'helm-14' | 'helm' | 'lens' | 'prometheus-operator' | 'stacklight';
export type MetricCategory = 'cpu' | 'memory' | 'network' | 'filesystem';

export interface PrometheusProviderDef {
  id: PrometheusProvider;
  label: string;
  namespace: string;
  service: string;
  port: number;
}

export const PROMETHEUS_PROVIDERS: PrometheusProviderDef[] = [
  { id: 'auto', label: 'Auto Detect Prometheus', namespace: '', service: '', port: 0 },
  {
    id: 'helm-14',
    label: 'Helm 14.x',
    namespace: 'monitoring',
    service: 'prometheus-stack-kube-prom-prometheus',
    port: 9090
  },
  { id: 'helm', label: 'Helm', namespace: 'monitoring', service: 'prometheus-server', port: 80 },
  { id: 'lens', label: 'Lens', namespace: 'lens-metrics', service: 'prometheus', port: 80 },
  {
    id: 'prometheus-operator',
    label: 'Prometheus Operator',
    namespace: 'monitoring',
    service: 'prometheus-k8s',
    port: 9090
  },
  {
    id: 'stacklight',
    label: 'Stacklight',
    namespace: 'stacklight',
    service: 'prometheus',
    port: 9090
  }
];

export const METRICS_SOURCE_OPTIONS: { value: MetricsSource; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'prometheus', label: 'Prometheus' },
  { value: 'metrics-server', label: 'Kubernetes Metrics Server' },
  { value: 'none', label: 'No metrics' }
];

export const ALL_METRIC_CATEGORIES: MetricCategory[] = ['cpu', 'memory', 'network', 'filesystem'];

export function getProviderDef(provider: PrometheusProvider): PrometheusProviderDef | undefined {
  return PROMETHEUS_PROVIDERS.find((p) => p.id === provider);
}
