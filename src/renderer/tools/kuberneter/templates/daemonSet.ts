export const daemonSetTemplate = `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: my-daemonset
  namespace: default
  labels:
    app: my-daemonset
spec:
  selector:
    matchLabels:
      app: my-daemonset
  template:
    metadata:
      labels:
        app: my-daemonset
    spec:
      containers:
        - name: fluentd
          image: fluent/fluentd:latest
          resources:
            limits:
              memory: 200Mi
            requests:
              cpu: 100m
              memory: 100Mi
`;
