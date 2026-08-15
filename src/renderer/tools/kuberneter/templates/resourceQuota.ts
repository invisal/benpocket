export const resourceQuotaTemplate = `apiVersion: v1
kind: ResourceQuota
metadata:
  name: my-quota
  namespace: default
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "10"
    limits.memory: 16Gi
`;
