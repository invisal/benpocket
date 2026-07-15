import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type LimitRangeData, type LimitRangeItem } from '../types/LimitRangeData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useLimitRanges(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const lrItem = item as unknown as {
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

        const name = lrItem.metadata?.name || '';
        const ns = lrItem.metadata?.namespace || '';

        const specLimits = lrItem.spec?.limits || [];
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

        const creationTimestamp = lrItem.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          labels: lrItem.metadata?.labels,
          annotations: lrItem.metadata?.annotations,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          limits
        };
      });
    },
    []
  );

  return useKubeQuery<LimitRangeData>('limitranges', transform, enabled);
}
