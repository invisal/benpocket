/**
 * Helm reports a release's chart as "<name>-<version>", e.g. "airflow-25.0.2".
 * Split it into the chart name and its version. The version is taken as the
 * substring after the last dash that starts with a digit, so chart names that
 * themselves contain dashes (e.g. "kube-state-metrics") are preserved.
 */
export function parseReleaseChart(chart: string): { name: string; version: string } {
  if (!chart) return { name: chart, version: '' };
  const match = chart.match(/^(.*)-(v?\d[\w.+-]*)$/);
  if (match) {
    return { name: match[1], version: match[2] };
  }
  return { name: chart, version: '' };
}
