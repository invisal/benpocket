export const limitRangeTemplate = `apiVersion: v1
kind: LimitRange
metadata:
  name: my-limit-range
  namespace: default
spec:
  limits:
    - default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      type: Container
`;
