export type KuberneterBottomPanelTabType = 'terminal' | 'create-resource';

export interface KuberneterBottomPanelTabItem {
  id: string;
  type: KuberneterBottomPanelTabType;
  title: string;
}

let nextTabId = 1;
export function generateTabId(type: KuberneterBottomPanelTabType): string {
  return `${type === 'terminal' ? 'term' : 'res'}-${nextTabId++}`;
}

export const DEFAULT_TEMPLATES: Record<string, string> = {
  Deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: default
  labels:
    app: my-app
spec:
  replicas: 1
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
          image: nginx:latest
          ports:
            - containerPort: 80`,
  Service: `apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP`,
  ConfigMap: `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: default
data:
  APP_ENV: "production"
  LOG_LEVEL: "info"`,
  Secret: `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: default
type: Opaque
stringData:
  API_KEY: "your-api-key-here"`,
  Pod: `apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  namespace: default
spec:
  containers:
    - name: nginx
      image: nginx:alpine`
};
