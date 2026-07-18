import { type K8sResource } from './K8sResource';

export interface DeployRevision {
  revision: number;
  name: string;
  podsCount: string;
  age: string;
  creationTimestamp: string;
}

export interface DeployRelatedPod {
  name: string;
  node: string;
  ns: string;
  ready: string;
  cpu: string;
  memory: string;
  status: string;
  hasWarning: boolean;
}

export interface DeployData {
  id: string;
  name: string;
  ns: string;
  ready: string;
  upToDate: number;
  available: number;
  age: string;
  rawAge: string;
  replicas: number;
  status: string;
  hasWarning: boolean;
  strategy: string;
  rawItem?: K8sResource;
  revisions?: DeployRevision[];
  podsList?: DeployRelatedPod[];
}
