export function formatAge(creationTimestamp: string): string {
  if (!creationTimestamp) return '-';
  const created = new Date(creationTimestamp).getTime();
  const diff = Date.now() - created;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}m`;
  return 'just now';
}
