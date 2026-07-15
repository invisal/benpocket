import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type CronJobData } from '../types/CronJobData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useCronJobs(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const name = item.metadata?.name || '';
        const ns = item.metadata?.namespace || '';
        const schedule = item.spec?.schedule || '-';
        const suspend = item.spec?.suspend ?? false;
        const rawActive = item.status?.active as unknown;
        const active = Array.isArray(rawActive) ? rawActive.length : 0;
        const timeZone = item.spec?.timeZone || '-';

        const lastScheduleTime = item.status?.lastScheduleTime;
        const lastSchedule = lastScheduleTime ? formatAge(lastScheduleTime) : '-';
        const nextExecution = suspend ? 'N/A' : '-';
        const hasWarning = active > 0 && suspend;

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          schedule,
          suspend,
          active,
          lastSchedule,
          nextExecution,
          timeZone,
          age: formatAge(item.metadata?.creationTimestamp || ''),
          rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
          hasWarning
        };
      });
    },
    []
  );

  return useKubeQuery<CronJobData>('cronjobs', transform, enabled);
}
