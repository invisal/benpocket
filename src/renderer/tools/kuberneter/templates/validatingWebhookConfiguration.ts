export const validatingWebhookConfigurationTemplate = `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: my-validating-webhook
webhooks:
  - name: example.webhook.io
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["pods"]
        scope: "Namespaced"
    clientConfig:
      service:
        namespace: default
        name: webhook-service
        path: /validate
    admissionReviewVersions: ["v1"]
    sideEffects: None
    timeoutSeconds: 5
`;
