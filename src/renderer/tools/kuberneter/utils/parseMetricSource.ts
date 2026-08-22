export interface ParsedMetricSource {
  namespace: string;
  service: string;
  port?: string;
  extra?: string;
}

/**
 * Parses metric source strings formatted as:
 * - "namespace / service:port (optional extra info)"
 * - "namespace / service (optional extra info)"
 * - "metrics-server (optional extra info)" -> defaults namespace to "kube-system", service to "metrics-server"
 */
export function parseMetricSource(source?: string): ParsedMetricSource | null {
  if (!source) return null;
  const trimmed = source.trim();

  // Match "namespace / service:port (extra)" or "namespace / service (extra)" or "namespace / service:port"
  const standardMatch = trimmed.match(
    /^([a-zA-Z0-9_.-]+)\s*\/\s*([a-zA-Z0-9_.-]+?)(?::(\d+))?(?:\s+(\(.*\)))?$/
  );
  if (standardMatch) {
    return {
      namespace: standardMatch[1],
      service: standardMatch[2],
      port: standardMatch[3],
      extra: standardMatch[4]
    };
  }

  // Match "metrics-server (extra)" or "metrics-server"
  const metricsServerMatch = trimmed.match(/^metrics-server(?:\s+(\(.*\)))?$/i);
  if (metricsServerMatch) {
    return {
      namespace: 'kube-system',
      service: 'metrics-server',
      extra: metricsServerMatch[1]
    };
  }

  return null;
}
