import type React from 'react';
import cn from 'cnfast';
import kuberneterIcon from '@renderer/assets/kuberneter-icon.svg';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { getTabTitleAndShortName } from '../../lib/loadAllClusters';

interface KuberneterActivityIconProps {
  tabId: string;
  payload: unknown;
  isActive: boolean;
}

export const KuberneterActivityIcon: React.FC<KuberneterActivityIconProps> = ({
  tabId,
  payload,
  isActive
}) => {
  const { kuberneterInstanceCluster, kuberneterInstanceServer, kuberneterRecentConnections } =
    useKuberneterStore();

  const { title, shortName } = getTabTitleAndShortName(
    { id: tabId, type: 'kuberneter', payload },
    kuberneterInstanceCluster,
    kuberneterInstanceServer,
    kuberneterRecentConnections
  );

  return (
    <div className="relative size-full flex items-center justify-center select-none" title={title}>
      <img src={kuberneterIcon} className="size-5 pointer-events-none" alt="Kuberneter" />
      {shortName && (
        <span
          className={cn(
            'absolute bottom-0.5 left-0 right-0 text-center text-[8px] font-extrabold tracking-tighter leading-none uppercase truncate px-0.5 pointer-events-none',
            isActive ? 'text-blue-950' : 'text-blue-400'
          )}
        >
          {shortName}
        </span>
      )}
    </div>
  );
};
