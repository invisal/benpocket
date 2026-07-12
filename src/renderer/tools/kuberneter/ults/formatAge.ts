export function formatAge(creationTimestamp: string): string {
  if (!creationTimestamp) return '-';
  const created = new Date(creationTimestamp).getTime();
  const diff = Date.now() - created;
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days >= 365) {
    const years = Math.floor(days / 365);
    const remDays = days % 365;
    return remDays > 0 ? `${years}y${remDays}d` : `${years}y`;
  }
  if (days > 0) {
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d${remHours}h` : `${days}d`;
  }
  if (hours > 0) {
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h${remMins}m` : `${hours}h`;
  }
  if (mins > 0) {
    const remSecs = secs % 60;
    return remSecs > 0 ? `${mins}m${remSecs}s` : `${mins}m`;
  }
  return `${Math.max(0, secs)}s`;
}
