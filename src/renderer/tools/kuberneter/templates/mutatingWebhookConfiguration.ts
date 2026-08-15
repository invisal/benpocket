export const mutatingWebhookConfigurationTemplate = `apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: my-mutating-webhook
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
        path: /mutate
    admissionReviewVersions: ["v1"]
    sideEffects: None
    timeoutSeconds: 5
`;
