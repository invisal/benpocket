import React from 'react';
import { useLayoutStore } from '../../../store/layout.store';
import { NamespaceInfoBar } from './lens/NamespaceInfoBar';
import { ClusterOverview } from './lens/ClusterOverview';
import { PodsTable } from './lens/PodsTable';
import { DeploymentsTable } from './lens/DeploymentsTable';
import { ServicesTable } from './lens/ServicesTable';
import { ConfigMapsTable } from './lens/ConfigMapsTable';

// Mock Kubernetes datasets
const podsData = [
  {
    name: 'api-gateway-5c8bd45db7-g4t5l',
    ns: 'default',
    status: 'Running',
    restarts: 0,
    age: '4d'
  },
  {
    name: 'auth-service-7bbdbff6f9-h8mks',
    ns: 'default',
    status: 'Running',
    restarts: 2,
    age: '12d'
  },
  {
    name: 'payment-processor-78d46dbb4d-f9s22',
    ns: 'default',
    status: 'Running',
    restarts: 0,
    age: '2h'
  },
  {
    name: 'coredns-5578556947-lq4h4',
    ns: 'kube-system',
    status: 'Running',
    restarts: 0,
    age: '16d'
  },
  { name: 'kube-proxy-8f92s', ns: 'kube-system', status: 'Running', restarts: 1, age: '16d' },
  {
    name: 'nginx-ingress-controller-4ks22',
    ns: 'ingress-nginx',
    status: 'Running',
    restarts: 0,
    age: '10d'
  },
  { name: 'postgres-db-0', ns: 'database', status: 'Running', restarts: 0, age: '16d' }
];

const deploysData = [
  { name: 'api-gateway', ns: 'default', ready: '1/1', upToDate: 1, available: 1, age: '4d' },
  { name: 'auth-service', ns: 'default', ready: '2/2', upToDate: 2, available: 2, age: '12d' },
  { name: 'payment-processor', ns: 'default', ready: '1/1', upToDate: 1, available: 1, age: '2h' }
];

const servicesData = [
  {
    name: 'api-gateway-service',
    ns: 'default',
    type: 'ClusterIP',
    clusterIp: '10.96.14.22',
    ports: '80/TCP',
    age: '4d'
  },
  {
    name: 'postgres-service',
    ns: 'database',
    type: 'ClusterIP',
    clusterIp: '10.96.88.109',
    ports: '5432/TCP',
    age: '16d'
  }
];

const configMapsData = [
  { name: 'api-gateway-config', ns: 'default', keys: 4, age: '4d' },
  { name: 'auth-jwt-keys', ns: 'default', keys: 2, age: '12d' }
];

export const LensWorkspace: React.FC = () => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const lensSelectedCluster = useLayoutStore(
    (s) => s.lensInstanceCluster[activeInstanceId] || 'minikube'
  );
  const lensSelectedNamespace = useLayoutStore(
    (s) => s.lensInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );
  const lensActiveResource = useLayoutStore(
    (s) => s.lensInstanceResource[activeInstanceId] || 'overview'
  );
  const setLensInstanceNamespace = useLayoutStore((s) => s.setLensInstanceNamespace);
  const setLensNamespace = (ns: string) => setLensInstanceNamespace(activeInstanceId, ns);

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <NamespaceInfoBar
        lensSelectedCluster={lensSelectedCluster}
        lensSelectedNamespace={lensSelectedNamespace}
        setLensNamespace={setLensNamespace}
      />

      {lensActiveResource === 'overview' && <ClusterOverview />}

      {lensActiveResource === 'pods' && (
        <PodsTable podsData={podsData} lensSelectedNamespace={lensSelectedNamespace} />
      )}

      {lensActiveResource === 'deployments' && (
        <DeploymentsTable deploysData={deploysData} lensSelectedNamespace={lensSelectedNamespace} />
      )}

      {lensActiveResource === 'services' && (
        <ServicesTable servicesData={servicesData} lensSelectedNamespace={lensSelectedNamespace} />
      )}

      {lensActiveResource === 'configmaps' && (
        <ConfigMapsTable
          configMapsData={configMapsData}
          lensSelectedNamespace={lensSelectedNamespace}
        />
      )}
    </div>
  );
};
