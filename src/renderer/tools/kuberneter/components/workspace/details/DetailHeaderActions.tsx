import type React from 'react';
import { PodHeaderActions } from './pod-detail';
import { NodeHeaderActions } from './NodeHeaderActions';
import { IngressClassHeaderActions } from './IngressClassHeaderActions';
import { EditDeleteHeaderActions } from './EditDeleteHeaderActions';
import { ConfigSecretHeaderActions } from './ConfigSecretHeaderActions';
import { GenericHeaderActions } from './GenericHeaderActions';
import { type PodData } from '../../../types/PodData';
import { type NodeData } from '../../../types/NodeData';
import { type IngressClassData } from '../../../types/IngressClassData';

interface DetailHeaderActionsProps {
  contentType: string;
  payload: unknown;
}

export const DetailHeaderActions: React.FC<DetailHeaderActionsProps> = ({
  contentType,
  payload
}) => {
  switch (contentType) {
    case 'application':
    case 'applications':
    case 'app':
    case 'apps':
      return null;
    case 'pod':
    case 'pods':
      return <PodHeaderActions payload={payload as PodData} />;
    case 'node':
    case 'nodes':
      return <NodeHeaderActions payload={payload as NodeData} />;
    case 'ingressclass':
    case 'ingressclasses':
      return <IngressClassHeaderActions payload={payload as IngressClassData} />;
    case 'configmap':
    case 'configmaps':
    case 'secret':
    case 'secrets':
      return <ConfigSecretHeaderActions contentType={contentType} payload={payload} />;
    case 'clusterrole':
    case 'role':
    case 'clusterrolebinding':
    case 'rolebinding':
      return <EditDeleteHeaderActions />;
    default:
      return <GenericHeaderActions contentType={contentType} payload={payload} />;
  }
};
