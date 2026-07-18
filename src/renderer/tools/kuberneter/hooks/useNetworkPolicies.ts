import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type NetworkPolicyData, type RuleData, type PeerData } from '../types/NetworkPolicyData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface NetworkPolicyK8sResource {
  metadata?: K8sResource['metadata'];
  spec?: {
    podSelector?: {
      matchLabels?: Record<string, string>;
      matchExpressions?: Array<{
        key: string;
        operator: string;
        values?: string[];
      }>;
    };
    ingress?: Array<{
      ports?: Array<{
        port?: string | number;
        protocol?: string;
      }>;
      from?: Array<{
        ipBlock?: {
          cidr: string;
          except?: string[];
        };
        namespaceSelector?: {
          matchLabels?: Record<string, string>;
          matchExpressions?: Array<{
            key: string;
            operator: string;
            values?: string[];
          }>;
        };
        podSelector?: {
          matchLabels?: Record<string, string>;
          matchExpressions?: Array<{
            key: string;
            operator: string;
            values?: string[];
          }>;
        };
      }>;
    }>;
    egress?: Array<{
      ports?: Array<{
        port?: string | number;
        protocol?: string;
      }>;
      to?: Array<{
        ipBlock?: {
          cidr: string;
          except?: string[];
        };
        namespaceSelector?: {
          matchLabels?: Record<string, string>;
          matchExpressions?: Array<{
            key: string;
            operator: string;
            values?: string[];
          }>;
        };
        podSelector?: {
          matchLabels?: Record<string, string>;
          matchExpressions?: Array<{
            key: string;
            operator: string;
            values?: string[];
          }>;
        };
      }>;
    }>;
    policyTypes?: string[];
  };
}

interface SelectorSpec {
  matchLabels?: Record<string, string>;
  matchExpressions?: Array<{
    key: string;
    operator: string;
    values?: string[];
  }>;
}

function formatSelector(selector: SelectorSpec | undefined): string {
  if (!selector) return '';
  if (selector.matchLabels) {
    return Object.entries(selector.matchLabels)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
  }
  if (selector.matchExpressions) {
    return selector.matchExpressions
      .map((expr) => {
        if (expr.operator === 'In') {
          return `${expr.key} in (${expr.values?.join(',') || ''})`;
        }
        if (expr.operator === 'NotIn') {
          return `${expr.key} not in (${expr.values?.join(',') || ''})`;
        }
        if (expr.operator === 'Exists') {
          return `${expr.key}`;
        }
        if (expr.operator === 'DoesNotExist') {
          return `!${expr.key}`;
        }
        return `${expr.key} ${expr.operator}`;
      })
      .join(', ');
  }
  if (Object.keys(selector).length === 0) {
    return '{}';
  }
  return '';
}

export function useNetworkPolicies(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const netItem = item as unknown as NetworkPolicyK8sResource;
        const name = netItem.metadata?.name || '';
        const ns = netItem.metadata?.namespace || '';
        const creationTimestamp = netItem.metadata?.creationTimestamp || '';

        const spec = netItem.spec;
        const policyTypes = spec?.policyTypes || ['Ingress'];
        const policyTypesStr = policyTypes.join(', ');

        const podSelectorStr = formatSelector(spec?.podSelector) || '{}';

        // Parse Ingress Rules
        const ingressRules: RuleData[] = [];
        spec?.ingress?.forEach((ing) => {
          const ports =
            ing.ports?.map((p) => {
              const proto = p.protocol || 'TCP';
              const portVal = p.port !== undefined ? p.port : '';
              return portVal ? `${proto}:${portVal}` : proto;
            }) || [];

          const peers =
            ing.from?.map((fromPeer) => {
              const peer: PeerData = {};
              if (fromPeer.ipBlock) {
                peer.ipBlock = {
                  cidr: fromPeer.ipBlock.cidr,
                  except: fromPeer.ipBlock.except
                };
              }
              const nsSel = formatSelector(fromPeer.namespaceSelector);
              if (nsSel) {
                peer.namespaceSelector = nsSel;
              }
              const podSel = formatSelector(fromPeer.podSelector);
              if (podSel) {
                peer.podSelector = podSel;
              }
              return peer;
            }) || [];

          ingressRules.push({ ports, peers });
        });

        // Parse Egress Rules
        const egressRules: RuleData[] = [];
        spec?.egress?.forEach((eg) => {
          const ports =
            eg.ports?.map((p) => {
              const proto = p.protocol || 'TCP';
              const portVal = p.port !== undefined ? p.port : '';
              return portVal ? `${proto}:${portVal}` : proto;
            }) || [];

          const peers =
            eg.to?.map((toPeer) => {
              const peer: PeerData = {};
              if (toPeer.ipBlock) {
                peer.ipBlock = {
                  cidr: toPeer.ipBlock.cidr,
                  except: toPeer.ipBlock.except
                };
              }
              const nsSel = formatSelector(toPeer.namespaceSelector);
              if (nsSel) {
                peer.namespaceSelector = nsSel;
              }
              const podSel = formatSelector(toPeer.podSelector);
              if (podSel) {
                peer.podSelector = podSel;
              }
              return peer;
            }) || [];

          egressRules.push({ ports, peers });
        });

        // Simple check: if a policy exists but policyTypes is empty or has zero rules
        const hasWarning = false;

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          policyTypes,
          policyTypesStr,
          podSelectorStr,
          ingressRules,
          egressRules,
          hasWarning,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          creationTimestamp,
          labels: netItem.metadata?.labels,
          annotations: netItem.metadata?.annotations,
          rawItem: netItem
        };
      });
    },
    []
  );

  return useKubeQuery<NetworkPolicyData>('networkpolicies', transform, enabled);
}
