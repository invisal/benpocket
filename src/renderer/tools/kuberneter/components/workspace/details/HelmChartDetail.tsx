import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Select as SelectPrimitive } from '@base-ui/react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import {
  type HelmChartItem,
  type HelmChartVersion,
  type HelmChartDetails
} from '../../../../../../preload/kuberneter/api';
import {
  Package,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface HelmChartDetailProps {
  payload: HelmChartItem;
  isTab?: boolean;
}

export const HelmChartDetail: React.FC<HelmChartDetailProps> = ({
  payload: chart,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const activeCluster = useKuberneterStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const activeNamespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );

  const kubeconfigPath = activeConfigPath === 'default' ? undefined : activeConfigPath;

  const [versions, setVersions] = useState<HelmChartVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(chart?.version || '');
  const [details, setDetails] = useState<HelmChartDetails | null>(null);

  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Installed check states
  const [isInstalled, setIsInstalled] = useState(false);
  const [, setInstalledReleaseName] = useState<string | null>(null);
  const [isLoadingInstalled, setIsLoadingInstalled] = useState(false);

  const checkIsInstalled = useCallback(async () => {
    if (!chart) return;
    setIsLoadingInstalled(true);
    try {
      const res = await window.kuberneter.helmListReleases(kubeconfigPath, activeCluster);
      if (Array.isArray(res)) {
        const baseChartName = chart.name.split('/')[1] || chart.name;
        const matchingRelease = res.find((release) => {
          const lastDash = release.chart.lastIndexOf('-');
          if (lastDash === -1) return false;
          const releaseChartName = release.chart.substring(0, lastDash);
          return releaseChartName === baseChartName;
        });

        if (matchingRelease) {
          setIsInstalled(true);
          setInstalledReleaseName(matchingRelease.name);
        } else {
          setIsInstalled(false);
          setInstalledReleaseName(null);
        }
      }
    } catch (err) {
      console.error('Error checking installed releases:', err);
    } finally {
      setIsLoadingInstalled(false);
    }
  }, [chart, kubeconfigPath, activeCluster]);

  useEffect(() => {
    queueMicrotask(() => {
      checkIsInstalled();
    });
  }, [checkIsInstalled]);

  // Install workflow states
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [releaseName, setReleaseName] = useState(chart?.name.split('/')[1] || '');
  const [namespace, setNamespace] = useState(
    activeNamespace === 'All Namespaces' ? 'default' : activeNamespace
  );
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    if (!chart) return;

    const fetchVersions = async () => {
      setIsLoadingVersions(true);
      try {
        const res = await window.kuberneter.helmGetChartVersions(chart.name, kubeconfigPath);
        if (Array.isArray(res)) {
          setVersions(res);
        }
      } catch (err) {
        console.error('Error fetching chart versions:', err);
      } finally {
        setIsLoadingVersions(false);
      }
    };

    queueMicrotask(() => {
      fetchVersions();
    });
  }, [chart, kubeconfigPath]);

  // Fetch details when selected version changes
  useEffect(() => {
    if (!chart || !selectedVersion) return;

    const fetchDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const res = await window.kuberneter.helmGetChartDetails(
          chart.name,
          selectedVersion,
          kubeconfigPath
        );
        if (res && !('error' in res)) {
          setDetails(res);
        } else {
          setDetails({
            name: chart.name.split('/')[1] || chart.name,
            version: selectedVersion,
            appVersion: chart.app_version,
            description: chart.description,
            home: '',
            icon: '',
            keywords: [],
            maintainers: []
          });
        }
      } catch (err) {
        console.error('Error fetching chart details:', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    queueMicrotask(() => {
      fetchDetails();
    });
  }, [chart, selectedVersion, kubeconfigPath]);

  const handleInstall = async () => {
    if (!releaseName || !namespace) {
      setInstallError('Release name and namespace are required.');
      return;
    }

    setInstalling(true);
    setInstallSuccess(null);
    setInstallError(null);

    try {
      const res = await window.kuberneter.helmInstallChart(
        releaseName,
        chart.name,
        selectedVersion,
        namespace,
        kubeconfigPath,
        activeCluster
      );

      if (res.error) {
        setInstallError(res.error);
      } else {
        setInstallSuccess(res.result || 'Chart installed successfully!');
        setShowInstallForm(false);
        checkIsInstalled();
      }
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  if (!chart) return null;

  const propertiesData: PropertyItem[] = [
    {
      id: 'version',
      name: 'Version',
      value: isLoadingVersions ? (
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Loader2 className="size-3 animate-spin" />
          <span className="text-[10px]">Loading versions...</span>
        </div>
      ) : (
        <SelectPrimitive.Root
          value={selectedVersion}
          onValueChange={(val) => val && setSelectedVersion(val)}
        >
          <SelectPrimitive.Trigger className="bg-transparent border-none text-[11px] text-accent hover:bg-surface-3/50 px-1.5 py-0.5 rounded font-semibold font-mono cursor-pointer outline-none focus:ring-0 flex items-center justify-between gap-1 select-none min-w-[90px] relative pr-5">
            <SelectPrimitive.Value />
            <SelectPrimitive.Icon className="absolute right-1 flex items-center justify-center">
              <ChevronDown className="size-3 text-accent pointer-events-none" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Positioner sideOffset={4} className="z-50 outline-none">
              <SelectPrimitive.Popup className="max-h-[160px] min-w-[120px] overflow-y-auto rounded-md border border-border-dark bg-surface p-1 text-text-base shadow-lg focus-visible:outline-none select-none">
                {versions.map((v) => (
                  <SelectPrimitive.Item
                    key={v.version}
                    value={v.version}
                    className="font-mono text-[11px] py-1 px-2 rounded hover:bg-surface-3 cursor-pointer outline-none text-zinc-350 hover:text-white flex items-center justify-between data-[selected]:bg-accent data-[selected]:text-emphasis-text select-none"
                  >
                    <SelectPrimitive.ItemText>{v.version}</SelectPrimitive.ItemText>
                    {v.app_version && (
                      <span className="text-[9px] text-zinc-555 ml-1.5">
                        (App: {v.app_version})
                      </span>
                    )}
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Popup>
            </SelectPrimitive.Positioner>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      )
    },
    {
      id: 'home',
      name: 'Home',
      value: details?.home ? (
        <a
          href={details.home}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 w-fit truncate max-w-xs"
          title={details.home}
        >
          <span className="truncate">{details.home}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <span className="text-zinc-600">—</span>
      )
    },
    {
      id: 'maintainers',
      name: 'Maintainers',
      value:
        details?.maintainers && details.maintainers.length > 0 ? (
          <span className="text-zinc-400">{details.maintainers.length} Maintainer(s)</span>
        ) : (
          <span className="text-zinc-650">—</span>
        ),
      hasDetail: !!(details?.maintainers && details.maintainers.length > 0),
      renderDetail: () => (
        <ul className="list-disc list-inside space-y-1 text-zinc-400 pr-1 select-text">
          {details?.maintainers?.map((m, idx) => (
            <li key={idx} className="truncate" title={m.name}>
              {m.name || 'Unknown'}
            </li>
          ))}
        </ul>
      )
    },
    {
      id: 'keywords',
      name: 'Keywords',
      value:
        details?.keywords && details.keywords.length > 0 ? (
          <span className="text-zinc-400">{details.keywords.length} Keyword(s)</span>
        ) : (
          <span className="text-zinc-650">—</span>
        ),
      hasDetail: !!(details?.keywords && details.keywords.length > 0),
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {details?.keywords?.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-3 border border-border/40 text-zinc-400 truncate max-w-full"
            >
              {kw}
            </span>
          ))}
        </div>
      )
    }
  ];

  return (
    <div
      className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1 text-zinc-300'}`}
    >
      {/* Top Section: Logo and Description */}
      <div className="flex gap-4 items-start bg-surface-3/30 border border-border/30 rounded-lg p-4 select-none">
        <div className="size-16 shrink-0 rounded bg-zinc-800/60 border border-border-dark flex items-center justify-center overflow-hidden p-1.5">
          {details?.icon && !imageError ? (
            <img
              src={details.icon}
              className="size-full object-contain"
              alt=""
              onError={() => setImageError(true)}
            />
          ) : (
            <Package className="size-8 text-zinc-650" />
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between min-h-[64px] gap-2.5">
          <div className="text-[12px] text-zinc-300 font-medium leading-relaxed">
            {isLoadingDetails ? (
              <div className="flex items-center gap-1.5 text-zinc-500 py-1">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Loading chart info...</span>
              </div>
            ) : (
              details?.description || chart.description
            )}
          </div>

          {isLoadingInstalled ? (
            <div className="flex items-center gap-1.5 text-zinc-500 py-1 text-[11px] self-end">
              <Loader2 className="size-3.5 animate-spin text-accent" />
              <span>Checking application status...</span>
            </div>
          ) : isInstalled ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold self-end select-none">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>Installed</span>
            </div>
          ) : (
            !showInstallForm &&
            !installing &&
            !installSuccess && (
              <Button
                variant="primary"
                onClick={() => setShowInstallForm(true)}
                className="font-semibold text-[11px] px-3.5 py-1 rounded cursor-pointer self-end transition-colors h-7"
              >
                Install
              </Button>
            )
          )}
        </div>
      </div>

      {/* Installation config form */}
      {showInstallForm && (
        <div className="bg-surface-3/50 border border-border-dark/80 p-4 rounded-lg space-y-4">
          <h3 className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">
            Install Configuration
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Release Name
              </label>
              <Input
                size="sm"
                value={releaseName}
                onChange={(e) => setReleaseName(e.target.value)}
                placeholder="release-name"
                className="w-full bg-surface text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Target Namespace
              </label>
              <Input
                size="sm"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                placeholder="namespace"
                className="w-full bg-surface text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInstallForm(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer h-7"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleInstall}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 cursor-pointer h-7"
            >
              Confirm Install
            </Button>
          </div>
        </div>
      )}

      {/* Installing Spinner */}
      {installing && (
        <div className="bg-surface-3/50 border border-border-dark/80 p-4 rounded-lg flex items-center justify-center gap-3">
          <Loader2 className="size-4.5 animate-spin text-blue-500" />
          <div className="text-[11px] text-zinc-400">
            Installing chart {chart.name}:{selectedVersion}...
          </div>
        </div>
      )}

      {/* Success banner */}
      {installSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Success</span>
          </div>
          <pre className="text-[10px] font-mono bg-black/20 p-3 rounded border border-border-dark/30 text-zinc-350 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
            {installSuccess}
          </pre>
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInstallSuccess(null)}
              className="text-[11px] h-7 border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400 cursor-pointer"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {installError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Installation Failed
            </span>
          </div>
          <pre className="text-[10px] font-mono bg-black/20 p-3 rounded border border-border-dark/30 text-zinc-350 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
            {installError}
          </pre>
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInstallError(null)}
              className="text-[11px] h-7 border-red-500/20 hover:bg-red-500/10 text-red-400 cursor-pointer"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1.5 border-t border-border-dark/60 pt-3.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>
    </div>
  );
};
