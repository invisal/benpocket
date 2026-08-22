const prefixMap: Record<string, string> = {
  pod: 'Pod',
  deployment: 'Deployment',
  daemonset: 'Daemon Set',
  statefulset: 'Stateful Set',
  replicaset: 'Replica Set',
  job: 'Job',
  cronjob: 'Cron Job',
  configmap: 'Config Map',
  secret: 'Secret',
  resourcequota: 'Resource Quota',
  limitrange: 'Limit Range',
  horizontalpodautoscaler: 'Horizontal Pod Autoscaler',
  hpa: 'Horizontal Pod Autoscaler',
  poddisruptionbudget: 'Pod Disruption Budget',
  pdb: 'Pod Disruption Budget',
  priorityclass: 'Priority Class',
  runtimeclass: 'Runtime Class',
  lease: 'Lease',
  service: 'Service',
  services: 'Service',
  persistentvolumeclaim: 'Persistent Volume Claim',
  pvc: 'Persistent Volume Claim',
  persistentvolume: 'Persistent Volume',
  pv: 'Persistent Volume',
  storageclass: 'Storage Class',
  namespace: 'Namespace',
  clusterrole: 'Cluster Role',
  role: 'Role',
  clusterrolebinding: 'Cluster Role Binding',
  rolebinding: 'Role Binding',
  application: 'Application',
  app: 'Application',
  nodes: 'Node',
  node: 'Node',
  event: 'Event',
  endpointslice: 'Endpoint Slice',
  endpointslices: 'Endpoint Slice',
  endpoints: 'Endpoints',
  endpoint: 'Endpoints',
  ingresses: 'Ingress',
  ingress: 'Ingress',
  ingressclasses: 'Ingress Class',
  ingressclass: 'Ingress Class',
  networkpolicies: 'Network Policy',
  networkpolicy: 'Network Policy',
  mutatingwebhook: 'Mutating Webhook',
  validatingwebhook: 'Validating Webhook',
  serviceaccount: 'Service Account',
  'helm-chart': 'Helm Chart',
  'helm-release': 'Helm Release',
  portforward: 'Port Forward',
  portforwarding: 'Port Forward'
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDetailResourceName(contentType: string, data: any): string {
  if (!data) return '';
  if (contentType === 'portforwarding') {
    return data.url || data.name || '';
  }
  return (
    data.name ||
    data.metadata?.name ||
    data.instance ||
    data.releaseName ||
    data.chartName ||
    data.involvedObject ||
    data.reason ||
    data.id ||
    ''
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDetailHeaderTitle(contentType: string, data: any): string {
  const resourceName = getDetailResourceName(contentType, data);
  const prefix = prefixMap[contentType] || (data as { kind?: string })?.kind || contentType;
  return resourceName ? `${prefix}: ${resourceName}` : `${prefix}: Details`;
}
