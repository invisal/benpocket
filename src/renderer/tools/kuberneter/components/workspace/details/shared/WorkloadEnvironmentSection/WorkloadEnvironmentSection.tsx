import { useState, useMemo, useCallback, type FC } from 'react';
import { ChevronRight, ChevronDown, RotateCcw, Save, Loader2, Boxes } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { useQueryClient } from '@tanstack/react-query';
import { useLayoutStore } from '@renderer/store/layout.store';
import { useKuberneterStore } from '../../../../../store/kuberneter.store';
import * as jsYaml from 'js-yaml';
import type { K8sResource } from '../../../../../types/K8sResource';
import { ContainerEnvEditor } from './ContainerEnvEditor';
import type { LiteralEnvEntry, ReferencedEnvEntry, EnvFromEntry, EnvVarSourceType } from './types';

interface WorkloadEnvironmentSectionProps {
  resourceKind?: string;
  name: string;
  namespace: string;
  rawItem?: K8sResource;
}

interface ContainerState {
  literal: LiteralEnvEntry[];
  referenced: ReferencedEnvEntry[];
  envFrom: EnvFromEntry[];
}

export const WorkloadEnvironmentSection: FC<WorkloadEnvironmentSectionProps> = ({
  resourceKind = 'Deployment',
  name,
  namespace,
  rawItem
}) => {
  const queryClient = useQueryClient();
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeContainerIndex, setActiveContainerIndex] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Extract containers from pod template spec
  const containers = useMemo(() => {
    const rawContainers = (
      rawItem?.spec?.template as {
        spec?: {
          containers?: Array<{
            name: string;
            image?: string;
            env?: Array<{
              name: string;
              value?: string;
              valueFrom?: {
                configMapKeyRef?: { name: string; key: string; optional?: boolean };
                secretKeyRef?: { name: string; key: string; optional?: boolean };
                fieldRef?: { fieldPath: string };
                resourceFieldRef?: { resource: string };
              };
            }>;
            envFrom?: Array<{
              configMapRef?: { name: string; optional?: boolean };
              secretRef?: { name: string; optional?: boolean };
              prefix?: string;
            }>;
          }>;
        };
      }
    )?.spec?.containers;

    return rawContainers || [];
  }, [rawItem]);

  // Parse raw containers into structured state
  const parseContainerData = useCallback(
    (containerList: typeof containers): Record<string, ContainerState> => {
      const stateMap: Record<string, ContainerState> = {};

      for (const c of containerList) {
        const literal: LiteralEnvEntry[] = [];
        const referenced: ReferencedEnvEntry[] = [];
        const envFrom: EnvFromEntry[] = [];

        if (Array.isArray(c.env)) {
          for (let i = 0; i < c.env.length; i++) {
            const e = c.env[i];
            if (e.valueFrom) {
              let sourceType: EnvVarSourceType = 'field';
              let refName: string | undefined;
              let refKey: string | undefined;
              let fieldPath: string | undefined;
              let resource: string | undefined;
              let optional: boolean | undefined;

              if (e.valueFrom.configMapKeyRef) {
                sourceType = 'configMap';
                refName = e.valueFrom.configMapKeyRef.name;
                refKey = e.valueFrom.configMapKeyRef.key;
                optional = e.valueFrom.configMapKeyRef.optional;
              } else if (e.valueFrom.secretKeyRef) {
                sourceType = 'secret';
                refName = e.valueFrom.secretKeyRef.name;
                refKey = e.valueFrom.secretKeyRef.key;
                optional = e.valueFrom.secretKeyRef.optional;
              } else if (e.valueFrom.fieldRef) {
                sourceType = 'field';
                fieldPath = e.valueFrom.fieldRef.fieldPath;
              } else if (e.valueFrom.resourceFieldRef) {
                sourceType = 'resource';
                resource = e.valueFrom.resourceFieldRef.resource;
              }

              referenced.push({
                id: `ref-${c.name}-${i}-${e.name}`,
                name: e.name,
                sourceType,
                refName,
                refKey,
                fieldPath,
                resource,
                optional
              });
            } else {
              literal.push({
                id: `lit-${c.name}-${i}-${e.name}`,
                name: e.name,
                value: e.value ?? ''
              });
            }
          }
        }

        if (Array.isArray(c.envFrom)) {
          for (let i = 0; i < c.envFrom.length; i++) {
            const ef = c.envFrom[i];
            if (ef.configMapRef) {
              envFrom.push({
                id: `envfrom-cm-${c.name}-${i}`,
                sourceType: 'configMap',
                name: ef.configMapRef.name,
                prefix: ef.prefix,
                optional: ef.configMapRef.optional
              });
            } else if (ef.secretRef) {
              envFrom.push({
                id: `envfrom-sec-${c.name}-${i}`,
                sourceType: 'secret',
                name: ef.secretRef.name,
                prefix: ef.prefix,
                optional: ef.secretRef.optional
              });
            }
          }
        }

        stateMap[c.name] = { literal, referenced, envFrom };
      }

      return stateMap;
    },
    []
  );

  const [containerStates, setContainerStates] = useState<Record<string, ContainerState>>(() =>
    parseContainerData(containers)
  );
  const [prevContainers, setPrevContainers] = useState(containers);

  // Sync state with containers during render if containers prop changes and not dirty
  if (containers !== prevContainers) {
    setPrevContainers(containers);
    if (!isDirty) {
      setContainerStates(parseContainerData(containers));
    }
  }

  const activeContainer = containers[activeContainerIndex] || containers[0];
  const activeContainerName = activeContainer?.name || '';
  const currentContainerState = containerStates[activeContainerName] || {
    literal: [],
    referenced: [],
    envFrom: []
  };

  // Handlers for modifying container variables
  const handleKeyChange = useCallback(
    (id: string, newKey: string) => {
      setContainerStates((prev) => {
        const cState = prev[activeContainerName] || { literal: [], referenced: [], envFrom: [] };
        return {
          ...prev,
          [activeContainerName]: {
            ...cState,
            literal: cState.literal.map((e) => (e.id === id ? { ...e, name: newKey } : e))
          }
        };
      });
      setIsDirty(true);
    },
    [activeContainerName]
  );

  const handleValueChange = useCallback(
    (id: string, newVal: string) => {
      setContainerStates((prev) => {
        const cState = prev[activeContainerName] || { literal: [], referenced: [], envFrom: [] };
        return {
          ...prev,
          [activeContainerName]: {
            ...cState,
            literal: cState.literal.map((e) => (e.id === id ? { ...e, value: newVal } : e))
          }
        };
      });
      setIsDirty(true);
    },
    [activeContainerName]
  );

  const handleDeleteLiteral = useCallback(
    (id: string) => {
      setContainerStates((prev) => {
        const cState = prev[activeContainerName] || { literal: [], referenced: [], envFrom: [] };
        return {
          ...prev,
          [activeContainerName]: {
            ...cState,
            literal: cState.literal.filter((e) => e.id !== id)
          }
        };
      });
      setIsDirty(true);
    },
    [activeContainerName]
  );

  const handleDeleteReferenced = useCallback(
    (id: string) => {
      setContainerStates((prev) => {
        const cState = prev[activeContainerName] || { literal: [], referenced: [], envFrom: [] };
        return {
          ...prev,
          [activeContainerName]: {
            ...cState,
            referenced: cState.referenced.filter((e) => e.id !== id)
          }
        };
      });
      setIsDirty(true);
    },
    [activeContainerName]
  );

  const handleDeleteEnvFrom = useCallback(
    (id: string) => {
      setContainerStates((prev) => {
        const cState = prev[activeContainerName] || { literal: [], referenced: [], envFrom: [] };
        return {
          ...prev,
          [activeContainerName]: {
            ...cState,
            envFrom: cState.envFrom.filter((e) => e.id !== id)
          }
        };
      });
      setIsDirty(true);
    },
    [activeContainerName]
  );

  const handleAddLiteral = useCallback(() => {
    setContainerStates((prev) => {
      const cState = prev[activeContainerName] || { literal: [], referenced: [], envFrom: [] };
      const newEntry: LiteralEnvEntry = {
        id: `lit-${activeContainerName}-${Date.now()}`,
        name: '',
        value: ''
      };
      return {
        ...prev,
        [activeContainerName]: {
          ...cState,
          literal: [...cState.literal, newEntry]
        }
      };
    });
    setIsDirty(true);
  }, [activeContainerName]);

  const handleReset = useCallback(() => {
    setContainerStates(parseContainerData(containers));
    setIsDirty(false);
  }, [containers, parseContainerData]);

  // Apply changes to cluster
  const handleApply = async () => {
    // Validate key names
    for (const [cName, cState] of Object.entries(containerStates)) {
      const emptyEntry = cState.literal.find((e) => !e.name.trim());
      if (emptyEntry) {
        useKuberneterStore.getState().addToast({
          type: 'warning',
          title: 'Validation Error',
          message: `Variable name cannot be empty in container "${cName}".`
        });
        return;
      }

      const keySet = new Set<string>();
      for (const e of [...cState.literal, ...cState.referenced]) {
        const trimmed = e.name.trim();
        if (keySet.has(trimmed)) {
          useKuberneterStore.getState().addToast({
            type: 'warning',
            title: 'Validation Error',
            message: `Duplicate variable name "${trimmed}" in container "${cName}".`
          });
          return;
        }
        keySet.add(trimmed);
      }
    }

    setIsApplying(true);
    try {
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      const resourceKey = resourceKind.toLowerCase().includes('stateful')
        ? 'statefulsets'
        : resourceKind.toLowerCase().includes('daemon')
          ? 'daemonsets'
          : 'deployments';

      let yamlContent = '';
      try {
        const res = await window.kuberneter.getResourceYaml(
          configPathArg,
          cluster,
          resourceKey,
          name,
          namespace
        );
        if (res.yaml) yamlContent = res.yaml;
      } catch (err) {
        console.warn('Failed to fetch live Resource YAML via IPC, falling back to rawItem', err);
      }

      if (!yamlContent && rawItem) {
        yamlContent = jsYaml.dump(rawItem);
      }

      const doc =
        (jsYaml.load(yamlContent) as {
          spec?: {
            template?: {
              spec?: {
                containers?: Array<{
                  name: string;
                  env?: Array<Record<string, unknown>>;
                  envFrom?: Array<Record<string, unknown>>;
                }>;
              };
            };
          };
        }) || {};

      const docContainers = doc.spec?.template?.spec?.containers || [];

      for (const dc of docContainers) {
        const cState = containerStates[dc.name];
        if (!cState) continue;

        // Rebuild env array
        const newEnvList: Array<Record<string, unknown>> = [];

        // Add literal env vars
        for (const lit of cState.literal) {
          newEnvList.push({
            name: lit.name.trim(),
            value: lit.value
          });
        }

        // Add referenced env vars
        for (const ref of cState.referenced) {
          const item: Record<string, unknown> = { name: ref.name.trim() };
          if (ref.sourceType === 'configMap' && ref.refName && ref.refKey) {
            item.valueFrom = {
              configMapKeyRef: {
                name: ref.refName,
                key: ref.refKey,
                ...(ref.optional !== undefined ? { optional: ref.optional } : {})
              }
            };
          } else if (ref.sourceType === 'secret' && ref.refName && ref.refKey) {
            item.valueFrom = {
              secretKeyRef: {
                name: ref.refName,
                key: ref.refKey,
                ...(ref.optional !== undefined ? { optional: ref.optional } : {})
              }
            };
          } else if (ref.sourceType === 'field' && ref.fieldPath) {
            item.valueFrom = {
              fieldRef: {
                fieldPath: ref.fieldPath
              }
            };
          } else if (ref.sourceType === 'resource' && ref.resource) {
            item.valueFrom = {
              resourceFieldRef: {
                resource: ref.resource
              }
            };
          }
          newEnvList.push(item);
        }

        if (newEnvList.length > 0) {
          dc.env = newEnvList;
        } else {
          delete dc.env;
        }

        // Rebuild envFrom array
        const newEnvFromList: Array<Record<string, unknown>> = [];
        for (const ef of cState.envFrom) {
          if (ef.sourceType === 'configMap') {
            newEnvFromList.push({
              configMapRef: {
                name: ef.name,
                ...(ef.optional !== undefined ? { optional: ef.optional } : {})
              },
              ...(ef.prefix ? { prefix: ef.prefix } : {})
            });
          } else if (ef.sourceType === 'secret') {
            newEnvFromList.push({
              secretRef: {
                name: ef.name,
                ...(ef.optional !== undefined ? { optional: ef.optional } : {})
              },
              ...(ef.prefix ? { prefix: ef.prefix } : {})
            });
          }
        }

        if (newEnvFromList.length > 0) {
          dc.envFrom = newEnvFromList;
        } else {
          delete dc.envFrom;
        }
      }

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
          title: `${resourceKind} Updated`,
          message: `Successfully updated environment variables for ${name}`
        });
        setIsDirty(false);
        queryClient.invalidateQueries({
          queryKey: [
            'kuberneter',
            'deployment-detail-data',
            rawConfigPath,
            cluster,
            namespace,
            name
          ]
        });
        queryClient.invalidateQueries({
          queryKey: ['kuberneter', 'deployments']
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

  // Compute total variable count across all containers
  const totalVariableCount = useMemo(() => {
    let count = 0;
    for (const cState of Object.values(containerStates)) {
      count += cState.literal.length + cState.referenced.length + cState.envFrom.length;
    }
    return count;
  }, [containerStates]);

  if (containers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col border-t border-border-dark/60 pt-3">
      {/* Collapsible Section Header */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center justify-between py-1 px-1 rounded hover:bg-surface-2/60 cursor-pointer select-none transition-colors group"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="size-3.5 text-zinc-400 group-hover:text-zinc-200 transition-transform" />
          ) : (
            <ChevronRight className="size-3.5 text-zinc-400 group-hover:text-zinc-200 transition-transform" />
          )}
          <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
            Environment Variables
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-3 text-zinc-400 font-mono">
            {totalVariableCount} {totalVariableCount === 1 ? 'var' : 'vars'}
            {containers.length > 1 ? ` (${containers.length} containers)` : ''}
          </span>
          {isDirty && (
            <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">
              Unsaved changes
            </span>
          )}
        </div>

        <span className="text-[10px] text-zinc-500 font-sans group-hover:text-zinc-300">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </span>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="flex flex-col gap-3 mt-3 pl-1">
          {/* Multi-container Selector Tabs */}
          {containers.length > 1 && (
            <div className="flex items-center gap-1 border-b border-border/60 pb-2">
              <span className="text-[10px] font-semibold text-zinc-500 mr-1 flex items-center gap-1">
                <Boxes className="size-3 text-zinc-400" /> Container:
              </span>
              {containers.map((c, idx) => {
                const isSelected = idx === activeContainerIndex;
                const cCount =
                  (containerStates[c.name]?.literal.length || 0) +
                  (containerStates[c.name]?.referenced.length || 0) +
                  (containerStates[c.name]?.envFrom.length || 0);

                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setActiveContainerIndex(idx)}
                    className={`px-2.5 py-1 text-xs font-mono rounded cursor-pointer transition-colors border-none ${
                      isSelected
                        ? 'bg-accent/20 text-accent font-semibold'
                        : 'bg-surface-3 text-zinc-400 hover:text-zinc-200 hover:bg-surface-4'
                    }`}
                  >
                    {c.name} ({cCount})
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Container Environment Editor */}
          {activeContainer && (
            <ContainerEnvEditor
              namespace={namespace}
              literalEntries={currentContainerState.literal}
              referencedEntries={currentContainerState.referenced}
              envFromEntries={currentContainerState.envFrom}
              onKeyChange={handleKeyChange}
              onValueChange={handleValueChange}
              onDeleteLiteral={handleDeleteLiteral}
              onDeleteReferenced={handleDeleteReferenced}
              onDeleteEnvFrom={handleDeleteEnvFrom}
              onAddLiteral={handleAddLiteral}
            />
          )}

          {/* Unsaved Changes & Apply Bar */}
          {isDirty && (
            <div className="flex items-center justify-between p-2.5 bg-surface-2/90 border border-amber-500/30 rounded-lg mt-1">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-amber-300 font-medium">
                  You have unsaved environment changes
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={isApplying}
                  className="h-7 px-2.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  <RotateCcw className="size-3 mr-1" />
                  Discard
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApply}
                  disabled={isApplying}
                  className="h-7 px-3 text-xs flex items-center gap-1.5"
                >
                  {isApplying ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Save className="size-3" />
                  )}
                  <span>Save & Apply</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
