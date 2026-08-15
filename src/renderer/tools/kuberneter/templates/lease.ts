export const leaseTemplate = `apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: my-lease
  namespace: default
spec:
  holderIdentity: holder-1
  leaseDurationSeconds: 15
`;
