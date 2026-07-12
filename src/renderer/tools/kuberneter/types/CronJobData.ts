export interface CronJobData {
  id: string;
  name: string;
  ns: string;
  schedule: string; // e.g. "*/1 * * * *"
  suspend: boolean;
  active: number; // number of currently active jobs
  lastSchedule: string; // formatted age since last schedule, e.g. "45s"
  nextExecution: string; // formatted time to next execution, e.g. "15s" or "N/A" if suspended
  timeZone: string; // e.g. "UTC" or "-" if not set
  age: string;
  rawAge: string;
  hasWarning: boolean;
}
