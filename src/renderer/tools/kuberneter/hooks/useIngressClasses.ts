import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type IngressClassData } from '../types/IngressClassData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface IngressClassK8sResource {
  metadata?: K8sResource['metadata'];
  spec?: {
    controller?: string;
    parameters?: {
      name?: string;
      scope?: string;
      kind?: string;
      apiGroup?: string;
    };
  };
}

export function useIngressClasses(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const icItem = item as unknown as IngressClassK8sResource;
        const name = icItem.metadata?.name || '';
        const creationTimestamp = icItem.metadata?.creationTimestamp || '';
        const annotations = icItem.metadata?.annotations;

        const isDefault = annotations?.['ingressclass.kubernetes.io/is-default-class'] === 'true';

        const controller = icItem.spec?.controller || '';
        const parametersName = icItem.spec?.parameters?.name || '';
        const parametersScope = icItem.spec?.parameters?.scope || '';
        const parametersKind = icItem.spec?.parameters?.kind || '';
        const parametersApiGroup = icItem.spec?.parameters?.apiGroup || '';

        return {
          id: name,
          name,
          isDefault,
          controller,
          parametersName,
          parametersScope,
          parametersKind,
          parametersApiGroup,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          annotations,
          rawItem: icItem
        } satisfies IngressClassData;
      });
    },
    []
  );

  return useKubeQuery<IngressClassData>('ingressclasses', transform, enabled);
}
