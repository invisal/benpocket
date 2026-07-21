/**
 * Parse a Kubernetes CPU quantity string to milli-cores (integer).
 * Examples: "500m" → 500, "2" → 2000, "0.5" → 500
 */
export function parseCpu(val: string | undefined | null): number {
  if (!val) return 0;
  const str = val.trim();
  if (str.endsWith('m')) {
    return parseInt(str.slice(0, -1), 10);
  }
  return parseFloat(str) * 1000;
}

/**
 * Parse a Kubernetes memory quantity string to MiB (float).
 * Examples: "512Mi" → 512, "1Gi" → 1024, "1073741824" → 1024 (raw bytes)
 */
export function parseMemoryToMiB(val: string | undefined | null): number {
  if (!val) return 0;
  const str = val.trim();
  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  const unit = str
    .replace(/[0-9.]/g, '')
    .trim()
    .toLowerCase();

  switch (unit) {
    case 'ki':
    case 'k':
      return num / 1024;
    case 'mi':
    case 'm':
      return num;
    case 'gi':
    case 'g':
      return num * 1024;
    case 'ti':
    case 't':
      return num * 1024 * 1024;
    default:
      return num / (1024 * 1024); // assuming raw bytes
  }
}
