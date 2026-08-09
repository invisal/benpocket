/**
 * Standardize any Kubernetes CPU quantity string (nanocores "n", microcores "u", millicores "m", or raw cores)
 * into a clean, normalized millicores string (e.g. "250m", "0.5m", "1500m").
 */
export function normalizeCpuString(rawCpu?: string): string {
  if (!rawCpu) return '0m';
  const str = rawCpu.trim();
  if (str.endsWith('n')) {
    const val = parseFloat(str.slice(0, -1));
    return isNaN(val) ? '0m' : `${parseFloat((val / 1e6).toFixed(3))}m`;
  }
  if (str.endsWith('u')) {
    const val = parseFloat(str.slice(0, -1));
    return isNaN(val) ? '0m' : `${parseFloat((val / 1e3).toFixed(3))}m`;
  }
  if (str.endsWith('m')) {
    const val = parseFloat(str.slice(0, -1));
    return isNaN(val) ? '0m' : `${parseFloat(val.toFixed(3))}m`;
  }
  const floatVal = parseFloat(str);
  return isNaN(floatVal) ? '0m' : `${parseFloat((floatVal * 1000).toFixed(3))}m`;
}

/**
 * Standardize any Kubernetes memory quantity string ("Ki", "Mi", "Gi", or raw bytes)
 * into a clean, normalized memory string (e.g. "4096Mi", "512Ki", "2.5Gi").
 */
export function normalizeMemoryString(rawMem?: string): string {
  if (!rawMem) return '0Mi';
  const str = rawMem.trim();
  let bytes = 0;
  if (str.endsWith('Ki')) bytes = (parseFloat(str.slice(0, -2)) || 0) * 1024;
  else if (str.endsWith('Mi')) bytes = (parseFloat(str.slice(0, -2)) || 0) * 1024 * 1024;
  else if (str.endsWith('Gi')) bytes = (parseFloat(str.slice(0, -2)) || 0) * 1024 * 1024 * 1024;
  else bytes = parseFloat(str) || 0;

  if (bytes >= 1024 * 1024 * 1024) {
    return `${parseFloat((bytes / (1024 * 1024 * 1024)).toFixed(2))}Gi`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))}Mi`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)}Ki`;
  }
  return `${Math.round(bytes)}B`;
}
