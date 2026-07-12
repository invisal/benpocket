export const parseK8sCapacity = (value: string): number => {
  if (!value) return 0;
  const match = value.match(/^([0-9.]+)([a-zA-Z]*)$/);
  if (!match) return parseFloat(value) || 0;
  const num = parseFloat(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
    k: 1000,
    m: 0.001,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
    P: 1000 ** 5,
    E: 1000 ** 6
  };

  const multiplier = multipliers[unit] || 1;
  return num * multiplier;
};

export const formatCapacity = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, idx)).toFixed(1)) + ' ' + sizes[idx];
};
