import { Age } from '../../Age';
import { useState, useMemo, useCallback, useEffect, useRef, memo, type FC } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { type SecretData } from '../../../types/SecretData';
import {
  Copy,
  Search,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  MoreVertical
} from 'lucide-react';
import * as jsYaml from 'js-yaml';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { KeyValueCodeEditor } from './KeyValueCodeEditor';
import { useOpenNamespaceDetail, useOpenResourceDetail } from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';
import { buildSecretDetailPayload } from '../../../hooks/open-detail/transformers/config.transformer';
import { Button } from '@renderer/components/ui/Button';
import { Menu } from '@renderer/components/ui/Menu';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { Tooltip } from '@renderer/components/ui/Tooltip';

interface SecretDetailProps {
  payload: SecretData;
  isTab?: boolean;
}

interface SecretEntry {
  id: string;
  key: string;
  value: string;
  isRevealed: boolean;
}

interface SecretEntryRowProps {
  id: string;
  entryKey: string;
  value: string;
  isRevealed: boolean;
  onKeyChange: (id: string, newKey: string) => void;
  onValueChange: (id: string, newValue: string) => void;
  onDelete: (id: string) => void;
  onCopy: (key: string, value: string) => void;
  onToggleReveal: (id: string) => void;
}

const SecretEntryRow: FC<SecretEntryRowProps> = memo(function SecretEntryRow({
  id,
  entryKey,
  value,
  isRevealed,
  onKeyChange,
  onValueChange,
  onDelete,
  onCopy,
  onToggleReveal
}: SecretEntryRowProps) {
  const handleValueChange = useCallback(
    (newVal: string) => {
      onValueChange(id, newVal);
    },
    [id, onValueChange]
  );

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        render={
          <div
            id={`secret-entry-row-${id}`}
            className="grid grid-cols-[1fr_1.5fr_auto] gap-2 p-2.5 items-start hover:bg-surface-2/30 transition-colors"
          >
            {/* Key Name Input */}
            <div className="flex flex-col min-w-0">
              <input
                type="text"
                placeholder="KEY_NAME"
                value={entryKey}
                onChange={(e) => onKeyChange(id, e.target.value)}
                className="w-full h-8 px-2.5 text-xs font-mono bg-surface-2 border border-border/60 focus:border-accent rounded text-zinc-200 outline-none transition-colors truncate"
              />
            </div>

            {/* Secret Value: Masked vs CodeMirror Editor */}
            <div className="flex flex-col min-w-0">
              {!isRevealed ? (
                <div className="flex items-center w-full h-8 px-3 bg-surface-2 border border-border/60 rounded text-zinc-400 select-none">
                  <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5 italic">
                    <Lock className="size-3 text-zinc-500" />
                    Value encrypted
                  </span>
                </div>
              ) : (
                <KeyValueCodeEditor
                  value={value}
                  onChange={handleValueChange}
                  placeholder="Secret value..."
                />
              )}
            </div>

            {/* Row Actions Menu */}
            <div className="flex items-center justify-center shrink-0 pt-0.5 w-8">
              <Menu.Root>
                <Menu.Trigger
                  render={
                    <button
                      type="button"
                      className="size-7 rounded hover:bg-surface-3 text-zinc-500 hover:text-zinc-200 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center outline-none"
                      title="Actions"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>
                  }
                />
                <Menu.Content align="end" className="min-w-32">
                  <Menu.Item
                    onClick={() => onCopy(entryKey, value)}
                    className="flex items-center gap-2"
                  >
                    <Copy className="size-3.5 text-zinc-400" />
                    <span>Copy</span>
                  </Menu.Item>
                  <Menu.Item onClick={() => onToggleReveal(id)} className="flex items-center gap-2">
                    {isRevealed ? (
                      <EyeOff className="size-3.5 text-zinc-400" />
                    ) : (
                      <Eye className="size-3.5 text-zinc-400" />
                    )}
                    <span>{isRevealed ? 'Hide Value' : 'Reveal Value'}</span>
                  </Menu.Item>
                  <Menu.Separator />
                  <Menu.Item
                    onClick={() => onDelete(id)}
                    className="flex items-center gap-2 text-rose-500 hover:text-rose-400"
                  >
                    <Trash2 className="size-3.5 text-rose-500" />
                    <span>Delete</span>
                  </Menu.Item>
                </Menu.Content>
              </Menu.Root>
            </div>
          </div>
        }
      />
      <ContextMenu.Content className="min-w-32">
        <ContextMenu.Item
          onClick={() => onCopy(entryKey, value)}
          className="flex items-center gap-2"
        >
          <Copy className="size-3.5 text-zinc-400" />
          <span>Copy</span>
        </ContextMenu.Item>
        <ContextMenu.Item onClick={() => onToggleReveal(id)} className="flex items-center gap-2">
          {isRevealed ? (
            <EyeOff className="size-3.5 text-zinc-400" />
          ) : (
            <Eye className="size-3.5 text-zinc-400" />
          )}
          <span>{isRevealed ? 'Hide Value' : 'Reveal Value'}</span>
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item
          onClick={() => onDelete(id)}
          className="flex items-center gap-2 text-rose-500 hover:text-rose-400"
        >
          <Trash2 className="size-3.5 text-rose-500" />
          <span>Delete</span>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
});

const decodeBase64 = (b64: string): string => {
  try {
    return decodeURIComponent(escape(window.atob(b64)));
  } catch {
    try {
      return window.atob(b64);
    } catch {
      return b64;
    }
  }
};

const encodeBase64 = (str: string): string => {
  try {
    return window.btoa(unescape(encodeURIComponent(str)));
  } catch {
    return window.btoa(str);
  }
};

export const SecretDetail: FC<SecretDetailProps> = ({ payload, isTab = false }) => {
  const queryClient = useQueryClient();
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openResourceDetail } = useOpenResourceDetail();

  const [searchFilter, setSearchFilter] = useState('');

  // Fetch fresh Secret with React Query caching
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'secret-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const res = await window.kuberneter.getResources(
        configPathArg,
        cluster,
        K8S_RESOURCE_KEYS.SECRETS,
        payload.ns
      );
      const item = ((res?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      return item || null;
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const rawItem = queryData || payload?.rawItem;
  const currentData: SecretData | undefined = rawItem
    ? buildSecretDetailPayload(
        payload?.name || rawItem.metadata?.name || '',
        payload?.ns || rawItem.metadata?.namespace || '',
        rawItem
      )
    : payload;

  const [prevData, setPrevData] = useState(currentData?.data);
  const [entries, setEntries] = useState<SecretEntry[]>(() => {
    return currentData?.data
      ? Object.entries(currentData.data).map(([k, v], idx) => {
          const decoded = decodeBase64(v);
          return {
            id: `entry-${idx}-${k}`,
            key: k,
            value: decoded,
            isRevealed: false
          };
        })
      : [];
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  if (currentData?.data !== prevData) {
    setPrevData(currentData?.data);
    if (!isDirty) {
      setEntries(
        currentData?.data
          ? Object.entries(currentData.data).map(([k, v], idx) => {
              const decoded = decodeBase64(v);
              return {
                id: `entry-${idx}-${k}`,
                key: k,
                value: decoded,
                isRevealed: false
              };
            })
          : []
      );
    }
  }

  const targetFocusIdRef = useRef<string | null>(null);

  const handleAddEntry = useCallback(() => {
    const newId = `new-${Date.now()}`;
    if (searchFilter) setSearchFilter('');
    setEntries((prev) => [
      ...prev,
      {
        id: newId,
        key: '',
        value: '',
        isRevealed: true
      }
    ]);
    setIsDirty(true);
    targetFocusIdRef.current = newId;
  }, [searchFilter]);

  useEffect(() => {
    if (targetFocusIdRef.current) {
      const el = document.getElementById(`secret-entry-row-${targetFocusIdRef.current}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const input = el.querySelector<HTMLInputElement>('input[type="text"]');
        if (input) {
          input.focus();
        }
      }
      targetFocusIdRef.current = null;
    }
  }, [entries]);

  const handleKeyChange = useCallback((id: string, newKey: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, key: newKey } : e)));
    setIsDirty(true);
  }, []);

  const handleValueChange = useCallback((id: string, newValue: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, value: newValue } : e)));
    setIsDirty(true);
  }, []);

  const handleDeleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setIsDirty(true);
  }, []);

  const toggleReveal = useCallback((id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, isRevealed: !e.isRevealed } : e)));
  }, []);

  const toggleAllReveal = useCallback((reveal: boolean) => {
    setEntries((prev) => prev.map((e) => ({ ...e, isRevealed: reveal })));
  }, []);

  const handleReset = useCallback(() => {
    const initial = currentData?.data
      ? Object.entries(currentData.data).map(([k, v], idx) => {
          const decoded = decodeBase64(v);
          return {
            id: `entry-${idx}-${k}`,
            key: k,
            value: decoded,
            isRevealed: false
          };
        })
      : [];
    setEntries(initial);
    setIsDirty(false);
  }, [currentData]);

  const handleCopy = useCallback((key: string, plainValue: string) => {
    navigator.clipboard.writeText(plainValue);
    useKuberneterStore.getState().addToast({
      type: 'info',
      title: 'Copied to Clipboard',
      message: key ? `Copied secret value of "${key}"` : 'Secret value copied to clipboard.'
    });
  }, []);

  const handleCopyAllAsEnv = useCallback(() => {
    if (entries.length === 0) return;
    const lines = entries.map((e) => `${e.key}=${e.value}`).join('\n');
    navigator.clipboard.writeText(lines);
    useKuberneterStore.getState().addToast({
      type: 'info',
      title: 'Copied to Clipboard',
      message: 'All entries copied in key=value format.'
    });
  }, [entries]);

  const handleApply = async () => {
    const emptyKeyEntry = entries.find((e) => !e.key.trim());
    if (emptyKeyEntry) {
      useKuberneterStore.getState().addToast({
        type: 'warning',
        title: 'Validation Error',
        message: 'Key name cannot be empty.'
      });
      return;
    }

    const keySet = new Set<string>();
    for (const e of entries) {
      const trimmed = e.key.trim();
      if (keySet.has(trimmed)) {
        useKuberneterStore.getState().addToast({
          type: 'warning',
          title: 'Validation Error',
          message: `Duplicate key name: "${trimmed}"`
        });
        return;
      }
      keySet.add(trimmed);
    }

    setIsApplying(true);
    try {
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      let yamlContent = '';
      try {
        const res = await window.kuberneter.getResourceYaml(
          configPathArg,
          cluster,
          'secret',
          payload.name,
          payload.ns
        );
        if (res.yaml) yamlContent = res.yaml;
      } catch (err) {
        console.warn('Failed to fetch live Resource YAML via IPC, falling back to rawItem', err);
      }

      if (!yamlContent && rawItem) {
        yamlContent = jsYaml.dump(rawItem);
      }

      const doc = (jsYaml.load(yamlContent) as Record<string, unknown>) || {};
      const newDataObj: Record<string, string> = {};
      for (const e of entries) {
        newDataObj[e.key.trim()] = encodeBase64(e.value);
      }
      doc.data = newDataObj;
      delete doc.stringData;

      const newYaml = jsYaml.dump(doc);
      const applyRes = await window.kuberneter.applyResourceYaml(newYaml, configPathArg, cluster);

      if (applyRes?.error) {
        useKuberneterStore.getState().addToast({
          type: 'error',
          title: 'Apply Failed',
          message: applyRes.error
        });
      } else {
        useKuberneterStore.getState().addToast({
          type: 'info',
          title: 'Secret Applied',
          message: `Successfully updated ${payload.name}`
        });
        setIsDirty(false);
        queryClient.invalidateQueries({
          queryKey: [
            'kuberneter',
            'secret-detail-data',
            rawConfigPath,
            cluster,
            payload.ns,
            payload.name
          ]
        });
        queryClient.invalidateQueries({
          queryKey: ['kuberneter', 'secrets']
        });
      }
    } catch (err) {
      useKuberneterStore.getState().addToast({
        type: 'error',
        title: 'Apply Failed',
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setIsApplying(false);
    }
  };

  const labels = currentData?.labels ? Object.entries(currentData.labels) : [];
  const annotations = currentData?.annotations ? Object.entries(currentData.annotations) : [];

  const filteredEntries = useMemo(() => {
    if (!searchFilter.trim()) return entries;
    const filterLower = searchFilter.toLowerCase();
    return entries.filter(
      (e) =>
        e.key.toLowerCase().includes(filterLower) || e.value.toLowerCase().includes(filterLower)
    );
  }, [entries, searchFilter]);

  const ownerReferences = rawItem?.metadata?.ownerReferences || [];

  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : currentData?.createdTime || '';

  if (!payload && !currentData) {
    return <div className="p-4 text-xs text-zinc-500">No secret details available.</div>;
  }

  const allRevealed = entries.length > 0 && entries.every((e) => e.isRevealed);

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={
              rawItem?.metadata?.creationTimestamp ||
              ((payload as unknown as Record<string, unknown>)?.creationTimestamp as string)
            }
          />{' '}
          ago ({createdTime || 'N/A'})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: currentData?.name || payload?.name || ''
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={() =>
            (currentData?.ns || payload?.ns) &&
            openNamespaceDetail(currentData?.ns || payload?.ns || '')
          }
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {currentData?.ns || payload?.ns}
        </span>
      )
    },
    {
      id: 'type',
      name: 'Secret Type',
      value: (
        <span className="font-mono text-zinc-300">
          {currentData?.type || payload?.type || 'Opaque'}
        </span>
      )
    }
  ];

  if (ownerReferences.length > 0) {
    propertiesData.push({
      id: 'controlledBy',
      name: 'Controlled By',
      value: (
        <div className="flex flex-wrap gap-1.5">
          {ownerReferences.map((ref) => (
            <span
              key={`${ref.kind}/${ref.name}`}
              onClick={() =>
                ref.kind &&
                ref.name &&
                openResourceDetail(ref.kind, currentData.ns || payload.ns || '', ref.name)
              }
              className="font-mono text-accent hover:underline cursor-pointer"
              title={`Open ${ref.kind} ${ref.name} in new tab`}
            >
              {ref.kind}/{ref.name}
            </span>
          ))}
        </div>
      )
    });
  }

  propertiesData.push(
    {
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Labels`,
      hasDetail: labels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    }
  );

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      <div className="flex flex-col gap-3 border-t border-border-dark/60 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
              Data ({entries.length} keys)
            </span>
            {isDirty && (
              <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {entries.length > 4 && (
              <div className="relative flex items-center">
                <Search className="size-3 text-zinc-500 absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search keys..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-6 pl-6 pr-2 text-[10px] font-mono bg-surface-3 border border-border/60 rounded text-foreground outline-none w-36"
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleAllReveal(!allRevealed)}
              className="h-6 px-2 text-[10px] font-medium flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
              title={allRevealed ? 'Mask all secret values' : 'Reveal all secret values'}
            >
              {allRevealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              <span>{allRevealed ? 'Hide All' : 'Reveal All'}</span>
            </Button>
            <Tooltip.Provider delay={200} closeDelay={0}>
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyAllAsEnv}
                      disabled={entries.length === 0}
                      className="size-6 p-0 flex items-center justify-center bg-surface-3 hover:bg-surface-4 text-zinc-300 disabled:opacity-40"
                    >
                      <Copy className="size-3" />
                    </Button>
                  }
                />
                <Tooltip.Content side="bottom">Copy all as .env</Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddEntry}
              className="h-6 px-2 text-[10px] font-medium flex items-center gap-1 bg-surface-3 hover:bg-surface-4 text-zinc-200"
            >
              <Plus className="size-3" />
              <span>Add Entry</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col border border-border/60 rounded-lg overflow-hidden bg-surface-1/40">
          <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2 px-3 py-2 bg-surface-3/50 border-b border-border/60 text-[11px] font-semibold text-zinc-400">
            <span>Name</span>
            <span>Value</span>
            <span className="w-8 text-center">Actions</span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="p-4 text-xs text-zinc-500 italic text-center">
              {entries.length === 0
                ? 'No data entries. Click "Add Entry" to create one.'
                : 'No matching data entries found.'}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/40">
              {filteredEntries.map((entry) => (
                <SecretEntryRow
                  key={entry.id}
                  id={entry.id}
                  entryKey={entry.key}
                  value={entry.value}
                  isRevealed={entry.isRevealed}
                  onKeyChange={handleKeyChange}
                  onValueChange={handleValueChange}
                  onDelete={handleDeleteEntry}
                  onCopy={handleCopy}
                  onToggleReveal={toggleReveal}
                />
              ))}
            </div>
          )}
        </div>

        {/* Action Bar when changes are made */}
        {isDirty && (
          <div className="flex items-center justify-end gap-2 p-2 bg-surface-3/40 border border-border/60 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isApplying}
              className="h-7 text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={isApplying}
              className="h-7 text-xs font-medium flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white"
            >
              {isApplying ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Applying YAML...</span>
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  <span>Apply Changes</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
