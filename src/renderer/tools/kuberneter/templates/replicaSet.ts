export const replicaSetTemplate = `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-replicaset
  namespace: default
  labels:
    app: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: nginx:alpine
          ports:
            - containerPort: 80
`;
