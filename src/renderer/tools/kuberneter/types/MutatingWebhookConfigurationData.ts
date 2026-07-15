export interface WebhookRule {
  apiGroups: string[];
  apiVersions: string[];
  operations: string[];
  resources: string[];
  scope: string;
}

export interface WebhookItem {
  name: string;
  clientConfig: {
    name?: string;
    namespace?: string;
    path?: string;
    port?: number;
    url?: string;
  };
  matchPolicy: string;
  failurePolicy: string;
  admissionReviewVersions: string[];
  reinvocationPolicy: string;
  sideEffects: string;
  timeoutSeconds: number;
  namespaceSelector?: string;
  objectSelector?: string;
  rules: WebhookRule[];
}

export interface MutatingWebhookConfigurationData {
  id: string; // name
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age: string;
  createdTime: string;
  apiVersion: string;
  webhooksCount: number;
  webhooks: WebhookItem[];
}
