import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import {
  type HorizontalPodAutoscalerData,
  type HpaMetric
} from '../types/HorizontalPodAutoscalerData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useHpas(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const hpaItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          spec?: {
            scaleTargetRef?: {
              apiVersion?: string;
              kind?: string;
              name?: string;
            };
            minReplicas?: number;
            maxReplicas?: number;
            targetCPUUtilizationPercentage?: number;
            metrics?: Array<{
              type: string;
              resource?: {
                name: string;
                target?: {
                  type: string;
                  averageUtilization?: number;
                  averageValue?: string;
                };
              };
            }>;
          };
          status?: {
            currentReplicas?: number;
            desiredReplicas?: number;
            currentCPUUtilizationPercentage?: number;
            currentMetrics?: Array<{
              type: string;
              resource?: {
                name: string;
                current?: {
                  averageUtilization?: number;
                  averageValue?: string;
                };
              };
            }>;
            conditions?: Array<{
              type: string;
              status: string;
              reason?: string;
              message?: string;
            }>;
          };
        };

        const name = hpaItem.metadata?.name || '';
        const ns = hpaItem.metadata?.namespace || '';

        const refKind = hpaItem.spec?.scaleTargetRef?.kind || '';
        const refName = hpaItem.spec?.scaleTargetRef?.name || '';

        const minPods = hpaItem.spec?.minReplicas ?? 1;
        const maxPods = hpaItem.spec?.maxReplicas ?? 1;
        const replicas = hpaItem.status?.currentReplicas ?? 0;

        const metricsList: HpaMetric[] = [];

        if (hpaItem.spec?.targetCPUUtilizationPercentage !== undefined) {
          const currentVal =
            hpaItem.status?.currentCPUUtilizationPercentage !== undefined
              ? `${hpaItem.status.currentCPUUtilizationPercentage}%`
              : 'unknown';
          metricsList.push({
            name: 'Resource cpu on Pods',
            current: currentVal,
            target: `${hpaItem.spec.targetCPUUtilizationPercentage}%`
          });
        }

        const specMetrics = hpaItem.spec?.metrics || [];
        const statusMetrics = hpaItem.status?.currentMetrics || [];

        specMetrics.forEach((m) => {
          if (m.type === 'Resource' && m.resource) {
            const resName = m.resource.name;

            let targetVal = '—';
            if (m.resource.target) {
              if (m.resource.target.type === 'Utilization') {
                targetVal = `${m.resource.target.averageUtilization || 0}%`;
              } else if (m.resource.target.type === 'AverageValue') {
                targetVal = m.resource.target.averageValue || '0';
              }
            }

            let currentVal = 'unknown';
            const matchingStatus = statusMetrics.find(
              (sm) => sm.type === 'Resource' && sm.resource?.name === resName
            );
            if (matchingStatus && matchingStatus.resource?.current) {
              if (matchingStatus.resource.current.averageUtilization !== undefined) {
                currentVal = `${matchingStatus.resource.current.averageUtilization}%`;
              } else if (matchingStatus.resource.current.averageValue !== undefined) {
                currentVal = matchingStatus.resource.current.averageValue;
              }
            }

            metricsList.push({
              name: `Resource ${resName} on Pods`,
              current: currentVal,
              target: targetVal
            });
          }
        });

        const conditions = hpaItem.status?.conditions || [];
        const trueCondition = conditions.find((c) => c.status === 'True');
        const statusText = trueCondition ? trueCondition.type : '—';

        const creationTimestamp = hpaItem.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          labels: hpaItem.metadata?.labels,
          annotations: hpaItem.metadata?.annotations,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          referenceKind: refKind,
          referenceName: refName,
          minPods,
          maxPods,
          replicas,
          statusText,
          metrics: metricsList
        };
      });
    },
    []
  );

  return useKubeQuery<HorizontalPodAutoscalerData>('horizontalpodautoscalers', transform, enabled);
}
