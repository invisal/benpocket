export const cronJobTemplate = `apiVersion: batch/v1
kind: CronJob
metadata:
  name: my-cronjob
  namespace: default
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cron-runner
              image: busybox:latest
              command: ["sh", "-c", "echo 'Running cron task...'"]
          restartPolicy: OnFailure
`;
