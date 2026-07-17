import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type ValidatingWebhookConfigurationData } from '../types/ValidatingWebhookConfigurationData';
import { type WebhookItem } from '../types/MutatingWebhookConfigurationData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useValidatingWebhooks(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const validatingItem = item as unknown as {
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

        const name = validatingItem.metadata?.name || '';
        const apiVersion = validatingItem.apiVersion || 'admissionregistration.k8s.io/v1';
        const rawWebhooks = validatingItem.webhooks || [];

        const webhooks: WebhookItem[] = rawWebhooks.map((w) => {
          const clientConfig = {
            name: w.clientConfig?.service?.name,
            namespace: w.clientConfig?.service?.namespace,
            path: w.clientConfig?.service?.path,
            port: w.clientConfig?.service?.port,
            url: w.clientConfig?.url
          };

          const parseSelector = (sel: typeof w.namespaceSelector) => {
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
            namespaceSelector: parseSelector(w.namespaceSelector),
            objectSelector: parseSelector(w.objectSelector),
            rules
          };
        });

        const creationTimestamp = validatingItem.metadata?.creationTimestamp || '';

        return {
          id: name,
          name,
          labels: validatingItem.metadata?.labels,
          annotations: validatingItem.metadata?.annotations,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          apiVersion,
          webhooksCount: webhooks.length,
          webhooks
        };
      });
    },
    []
  );

  return useKubeQuery<ValidatingWebhookConfigurationData>(
    'validatingwebhookconfigurations',
    transform,
    enabled
  );
}
