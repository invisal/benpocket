import { type WebhookItem } from './MutatingWebhookConfigurationData';
import { type K8sResource } from './K8sResource';

export interface ValidatingWebhookConfigurationData {
  id: string; // name
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime: string;
  apiVersion: string;
  webhooksCount: number;
  webhooks: WebhookItem[];
  rawItem?: K8sResource;
}
