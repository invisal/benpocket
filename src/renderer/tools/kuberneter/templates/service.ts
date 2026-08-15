export const serviceTemplate = `apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: default
  labels:
    app: my-app
spec:
  type: ClusterIP
  selector:
    app: my-app
  ports:
    - name: http
      port: 80
      targetPort: 80
      protocol: TCP
`;
