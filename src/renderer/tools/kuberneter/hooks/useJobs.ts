import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type JobData } from '../types/JobData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useJobs(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const name = item.metadata?.name || '';
        const ns = item.metadata?.namespace || '';
        const desired = item.spec?.completions ?? 1;
        const succeeded = item.status?.succeeded ?? 0;
        const failed = item.status?.failed ?? 0;

        const conditions = item.status?.conditions || [];
        const condStr =
          conditions
            .filter((c) => c.status === 'True')
            .map((c) => c.type)
            .join(', ') || (succeeded > 0 ? 'Complete' : failed > 0 ? 'Failed' : 'Running');

        const hasWarning = failed > 0;

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          completions: `${succeeded}/${desired}`,
          succeeded,
          desired,
          age: formatAge(item.metadata?.creationTimestamp || ''),
          rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
          conditions: condStr,
          hasWarning
        };
      });
    },
    []
  );

  return useKubeQuery<JobData>('jobs', transform, enabled);
}
