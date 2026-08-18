import { formatAge } from '../../../utils/formatAge';
import { type ConfigMapData } from '../../../types/ConfigMapData';
import { type SecretData } from '../../../types/SecretData';
import { type ServiceAccountData } from '../../../types/ServiceAccountData';
import { type K8sResource } from '../../../types/K8sResource';

export function buildConfigMapDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): ConfigMapData {
  const keysList = Object.keys(rawResource?.data || {});
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    keysCount: keysList.length,
    keysList,
    data: rawResource?.data as Record<string, string> | undefined,
    binaryData: rawResource?.binaryData,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp)
  };
}

export function buildSecretDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): SecretData {
  const keysList = Object.keys(rawResource?.data || {});
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    type: (rawResource?.type as string) || 'Opaque',
    keysCount: keysList.length,
    keysList,
    data: rawResource?.data as Record<string, string> | undefined,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    age: formatAge(creationTimestamp)
  };
}

export function buildServiceAccountDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): ServiceAccountData {
  const rawSecrets = (rawResource as { secrets?: Array<{ name: string }> })?.secrets || [];
  const rawImagePullSecrets =
    (rawResource as { imagePullSecrets?: Array<{ name: string }> })?.imagePullSecrets || [];
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    secretsCount: rawSecrets.length,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    secrets: rawSecrets.map((s) => s.name || '').filter(Boolean),
    imagePullSecrets: rawImagePullSecrets.map((s) => s.name || '').filter(Boolean),
    rawItem: rawResource
  };
}
