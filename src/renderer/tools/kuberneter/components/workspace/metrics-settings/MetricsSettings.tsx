import type React from 'react';
import { useState } from 'react';
import { CheckSquare, Square, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from 'cnfast';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import {
  useKuberneterStore,
  DEFAULT_METRICS_CONFIG,
  type MetricsConfig
} from '../../../store/kuberneter.store';
import {
  METRICS_SOURCE_OPTIONS,
  PROMETHEUS_PROVIDERS,
  ALL_METRIC_CATEGORIES,
  type MetricCategory
} from '../../../lib/metricsProviders';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { Select } from '@renderer/components/ui/Select';

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">{children}</span>
  );
}

// ─── Checkbox row ─────────────────────────────────────────────────────────────

function CheckboxRow({
  checked,
  onChange,
  children
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-start gap-2 text-left cursor-pointer bg-transparent border-none p-0 w-full"
    >
      {checked ? (
        <CheckSquare className="size-3.5 text-accent mt-0.5 shrink-0" />
      ) : (
        <Square className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
      )}
      <span className="text-sm text-foreground leading-snug">{children}</span>
    </button>
  );
}

// ─── Thin select wrapper using ui/Select ─────────────────────────────────────
// ui/Select is a Base UI headless dropdown — we wrap it to match the simple
// value/options/onChange pattern used throughout this component.

function SettingsSelect<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Select.Root value={value} onValueChange={(v) => v && onChange(v as T)}>
      <Select.Trigger variant="outline" size="sm" className="w-full justify-between">
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        {options.map((opt) => (
          <Select.Item key={opt.value} value={opt.value}>
            {opt.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

// ─── Test connection result type ──────────────────────────────────────────────

type TestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; latencyMs: number; source: string }
  | { status: 'error'; message: string };

// ─── Main component ───────────────────────────────────────────────────────────

export function MetricsSettings() {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const metricsConfig = useKuberneterStore(
    (s) => s.kuberneterMetricsConfig[cluster] ?? DEFAULT_METRICS_CONFIG
  );
  const setMetricsConfig = useKuberneterStore((s) => s.setKuberneterMetricsConfig);

  const [testState, setTestState] = useState<TestState>({ status: 'idle' });

  const configPath = rawConfigPath === 'default' ? undefined : rawConfigPath;

  function patch(changes: Partial<MetricsConfig>) {
    setMetricsConfig(cluster, changes);
  }

  const usesPrometheus = metricsConfig.source === 'auto' || metricsConfig.source === 'prometheus';

  // ── Test connection ──
  async function handleTest() {
    setTestState({ status: 'loading' });
    try {
      const res = await window.kuberneter.testPrometheus({
        kubeconfigPath: configPath,
        contextName: cluster || undefined,
        provider: metricsConfig.provider,
        useHttps: metricsConfig.useHttps,
        pathPrefix: metricsConfig.pathPrefix,
        kubectlPath: useKuberneterStore.getState().kuberneterKubectlPath || undefined
      });
      if (res.ok) {
        setTestState({ status: 'ok', latencyMs: res.latencyMs, source: res.source ?? '' });
      } else {
        setTestState({ status: 'error', message: res.error ?? 'Connection failed' });
      }
    } catch (e) {
      setTestState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Clear cache ──
  async function handleClearCache() {
    await window.kuberneter.clearPrometheusCache(configPath, cluster || undefined);
    setTestState({ status: 'idle' });
  }

  const allHidden = metricsConfig.hiddenMetrics.length === ALL_METRIC_CATEGORIES.length;
  const hiddenLabel =
    metricsConfig.hiddenMetrics.length === 0
      ? 'All metrics are visible on the UI'
      : `Hiding: ${metricsConfig.hiddenMetrics.join(', ')}`;

  return (
    <div className="flex flex-col gap-5 p-6 max-w-xl">
      {/* ── Metrics Source ── */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Metrics Source</SectionLabel>
        <SettingsSelect
          value={metricsConfig.source}
          options={METRICS_SOURCE_OPTIONS}
          onChange={(v) => patch({ source: v })}
        />
        <p className="text-sm text-muted-foreground">
          Currently used metrics source:{' '}
          <span className="text-foreground font-medium">
            {METRICS_SOURCE_OPTIONS.find((o) => o.value === metricsConfig.source)?.label}
          </span>
        </p>
      </div>

      {/* ── Refresh Interval ── */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Refresh Interval</SectionLabel>
        <SettingsSelect
          value={String(metricsConfig.refreshInterval ?? 3)}
          options={[
            { value: '3', label: 'Every 3 seconds (Default)' },
            { value: '5', label: 'Every 5 seconds' },
            { value: '10', label: 'Every 10 seconds' },
            { value: '30', label: 'Every 30 seconds' },
            { value: '60', label: 'Every 1 minute' },
            { value: '0', label: 'Off (Manual refresh)' }
          ]}
          onChange={(v) => patch({ refreshInterval: parseInt(v, 10) })}
        />
        <p className="text-sm text-muted-foreground">
          How frequently live metric charts (Pod & Node metrics) poll for updates.
        </p>
      </div>

      {/* ── Prometheus section (hidden for metrics-server / none) ── */}
      {usesPrometheus && (
        <>
          {/* Provider */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Prometheus</SectionLabel>
            <SettingsSelect
              value={metricsConfig.provider}
              options={PROMETHEUS_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
              onChange={(v) => {
                patch({ provider: v });
                setTestState({ status: 'idle' });
              }}
            />
            <p className="text-sm text-muted-foreground">
              What query format is used to fetch metrics from Prometheus
            </p>
            <CheckboxRow
              checked={metricsConfig.filterEmptyContainers}
              onChange={(v) => patch({ filterEmptyContainers: v })}
            >
              Filter empty containers from the Prometheus queries. Try changing this to fix missing
              metrics.
            </CheckboxRow>
          </div>

          {/* Auto-detect details + test */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Prometheus Details</SectionLabel>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleTest}
                disabled={testState.status === 'loading'}
                className={cn(testState.status === 'loading' && 'opacity-70')}
              >
                {testState.status === 'loading' && <Loader2 className="size-3 animate-spin" />}
                Test Connection
              </Button>
              {metricsConfig.provider === 'auto' && (
                <Button variant="outline" size="sm" onClick={handleClearCache}>
                  Re-detect
                </Button>
              )}
            </div>

            {testState.status === 'ok' && (
              <div className="flex items-start gap-1.5 text-sm text-emerald-500">
                <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  Connected in {testState.latencyMs}ms — {testState.source}
                </span>
              </div>
            )}
            {testState.status === 'error' && (
              <div className="flex items-start gap-1.5 text-sm text-red-400">
                <XCircle className="size-3.5 mt-0.5 shrink-0" />
                <span>{testState.message}</span>
              </div>
            )}
          </div>

          {/* HTTPS */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Prometheus HTTPS Requests</SectionLabel>
            <CheckboxRow checked={metricsConfig.useHttps} onChange={(v) => patch({ useHttps: v })}>
              Use HTTPS for Prometheus requests
            </CheckboxRow>
            <p className="text-sm text-muted-foreground">
              Externally hosted Prometheus might listen using HTTPS. Usually this is not needed.
            </p>
          </div>

          {/* Path prefix */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Custom Path Prefix</SectionLabel>
            <Input
              size="sm"
              value={metricsConfig.pathPrefix}
              onChange={(e) => patch({ pathPrefix: e.target.value })}
              placeholder="/prometheus"
            />
            <p className="text-sm text-muted-foreground">
              An optional path prefix added to all Prometheus requests. Useful if Prometheus expects
              e.g. /prometheus to be added to all requests.
            </p>
          </div>
        </>
      )}

      {/* ── Hide Metrics from UI ── */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Hide Metrics from the UI</SectionLabel>
        <div className="flex items-center gap-2">
          <select
            multiple
            value={metricsConfig.hiddenMetrics}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map(
                (o) => o.value as MetricCategory
              );
              patch({ hiddenMetrics: selected });
            }}
            className="flex-1 bg-surface-2 border border-border text-foreground rounded px-2 py-1.5 text-sm outline-none"
            size={4}
          >
            {ALL_METRIC_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="capitalize py-0.5">
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
          <div className="flex flex-col gap-1.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => patch({ hiddenMetrics: [...ALL_METRIC_CATEGORIES] })}
              disabled={allHidden}
            >
              Hide all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => patch({ hiddenMetrics: [] })}
              disabled={metricsConfig.hiddenMetrics.length === 0}
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="bg-surface-2 border border-border rounded px-3 py-2 text-sm text-muted-foreground text-center">
          {hiddenLabel}
        </div>
      </div>
    </div>
  );
}
