export const parseK8sCapacity = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  const str = value.toString().trim();
  if (!str) return 0;

  const match = str.match(/^([0-9.]+)\s*([a-zA-Z]*)$/);
  if (!match) return parseFloat(str) || 0;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;
  const unit = match[2];

  const multipliers: Record<string, number> = {
    Ki: 1024,
    KiB: 1024,
    ki: 1024,
    k: 1000,
    Mi: 1024 ** 2,
    MiB: 1024 ** 2,
    mi: 1024 ** 2,
    M: 1000 ** 2,
    Gi: 1024 ** 3,
    GiB: 1024 ** 3,
    gi: 1024 ** 3,
    G: 1000 ** 3,
    Ti: 1024 ** 4,
    TiB: 1024 ** 4,
    ti: 1024 ** 4,
    T: 1000 ** 4,
    Pi: 1024 ** 5,
    PiB: 1024 ** 5,
    pi: 1024 ** 5,
    P: 1000 ** 5,
    Ei: 1024 ** 6,
    EiB: 1024 ** 6,
    ei: 1024 ** 6,
    E: 1000 ** 6,
    m: 0.001,
    u: 0.000001,
    n: 0.000000001
  };

  const multiplier = multipliers[unit] ?? 1;
  return num * multiplier;
};

/**
 * Parse a Kubernetes CPU quantity string to milli-cores (integer).
 * Examples: "500m" -> 500, "2" -> 2000, "0.5" -> 500
 */
export function parseCpu(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val * 1000;

  const str = val.toString().trim();
  if (!str) return 0;

  if (str.endsWith('n')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : num / 1e6; // nanocores → millicores
  }

  if (str.endsWith('u')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : num / 1e3; // microcores → millicores
  }

  if (str.endsWith('m')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : num; // millicores → millicores
  }

  const rawCores = parseK8sCapacity(str);
  return rawCores * 1000; // cores → millicores
}

/**
 * Parse a Kubernetes memory quantity string to MiB (float).
 * Examples: "512Mi" -> 512, "1Gi" -> 1024, "1073741824" -> 1024 (raw bytes)
 */
export function parseMemoryToMiB(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  const bytes = parseK8sCapacity(val);
  return bytes / (1024 * 1024);
}

/**
 * Formats byte numbers into human readable string (e.g. 31.3 GiB, 512 MiB)
 */
export const formatCapacity = (bytes: number): string => {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, idx)).toFixed(1)) + ' ' + sizes[idx];
};
