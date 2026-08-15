export const runtimeClassTemplate = `apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: custom-runtime
handler: custom-handler
`;
