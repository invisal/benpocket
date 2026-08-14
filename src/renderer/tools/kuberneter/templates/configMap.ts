export const configMapTemplate = `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: default
data:
  APP_ENV: "production"
  LOG_LEVEL: "info"
`;
