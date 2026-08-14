export const secretTemplate = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: default
type: Opaque
stringData:
  API_KEY: "your-api-key-here"
`;
