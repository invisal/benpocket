export const jobTemplate = `apiVersion: batch/v1
kind: Job
metadata:
  name: my-job
  namespace: default
spec:
  template:
    spec:
      containers:
        - name: job-runner
          image: busybox:latest
          command: ["sh", "-c", "echo 'Job completed!'"]
      restartPolicy: Never
  backoffLimit: 4
`;
