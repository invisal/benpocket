import { type K8sResource } from './K8sResource';
import { type DeployRelatedPod } from './DeployData';

export interface JobData {
  id: string;
  name: string;
  ns: string;
  completions: string; // e.g. "1/1"
  succeeded: number;
  desired: number;
  age: string;
  rawAge: string;
  conditions: string; // e.g. "SuccessCriteriaMet", "Failed", "Running"
  hasWarning: boolean;
  createdTime?: string;
  rawItem?: K8sResource;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  selector?: Record<string, string>;
  controlledBy?: { kind: string; name: string };
  podsList?: DeployRelatedPod[];
}
