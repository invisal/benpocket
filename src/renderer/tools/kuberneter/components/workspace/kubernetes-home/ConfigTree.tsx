import React, { useState, useEffect } from 'react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { useToolTabs } from '../../../../../src/components/providers/ToolProvider';
import { Input } from '../../../../../src/components/ui/Input';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Globe,
  Trash2,
  Search,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface K8sContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
  server?: string;
  isActive: boolean;
}

function highlightText(text: string, search: string): React.ReactNode {
  if (!search) return text;
  const regex = new RegExp(`(${search.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-accent/20 text-accent font-semibold px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

interface ConfigTreeProps {
  configPaths: string[];
  activeConfigPath: string;
  activeContext: string;
  onConnect: (contextName: string, configPath: string, server?: string, namespace?: string) => void;
  onRemoveConfig: (configPath: string) => void;
}

export const ConfigTree: React.FC<ConfigTreeProps> = ({
  configPaths,
  activeConfigPath,
  activeContext,
  onConnect,
  onRemoveConfig
}) => {
  const { addActivityInstance } = useLayoutStore();
  const { addKuberneterRecentConnection } = useKuberneterStore();

  const { openTab } = useToolTabs();

  const [searchTerm, setSearchTerm] = useState('');
  const [contextsMap, setContextsMap] = useState<Record<string, K8sContext[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [expandedConfigs, setExpandedConfigs] = useState<Record<string, boolean>>({
    default: true
  });

  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    contextName: string;
    configPath: string;
    server?: string;
    namespace?: string;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, ctx: K8sContext, configPath: string) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      contextName: ctx.name,
      configPath,
      server: ctx.server,
      namespace: ctx.namespace
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleConnectNewInstance = (
    contextName: string,
    configPath: string,
    server?: string,
    namespace?: string
  ) => {
    const newInstanceId = `kuberneter-${Date.now()}`;
    addKuberneterRecentConnection(contextName, configPath, server);
    addActivityInstance('kuberneter', newInstanceId, {
      cluster: contextName,
      configPath,
      namespace: namespace || 'default'
    });
    openTab('kuberneter', { instanceId: newInstanceId });
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      handleCloseContextMenu();
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const allConfigs = ['default', ...configPaths];

  // Fetch contexts for a single configuration file path
  const fetchConfigContexts = async (configPath: string) => {
    setLoadingMap((prev) => ({ ...prev, [configPath]: true }));
    setErrorMap((prev) => {
      const copy = { ...prev };
      delete copy[configPath];
      return copy;
    });

    try {
      const pathArg = configPath === 'default' ? undefined : configPath;
      const res = await window.kuberneter.listContexts(pathArg);

      if (res && typeof res === 'object' && 'error' in res) {
        setErrorMap((prev) => ({ ...prev, [configPath]: res.error }));
        setContextsMap((prev) => ({ ...prev, [configPath]: [] }));
      } else if (Array.isArray(res)) {
        setContextsMap((prev) => ({ ...prev, [configPath]: res }));
        // Automatically expand folders if they have contexts
        if (res.length > 0) {
          setExpandedConfigs((prev) => ({ ...prev, [configPath]: true }));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMap((prev) => ({ ...prev, [configPath]: msg || 'Failed to list contexts' }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [configPath]: false }));
    }
  };

  // Load contexts for all config files on change/mount
  useEffect(() => {
    for (const configPath of allConfigs) {
      // Fetch if not already loaded or if the list of paths changes
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchConfigContexts(configPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(configPaths)]);

  const toggleExpand = (configPath: string) => {
    setExpandedConfigs((prev) => ({
      ...prev,
      [configPath]: !prev[configPath]
    }));
  };

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 min-w-0">
      {/* Search & Header Row */}
      <div className="shrink-0 flex items-center justify-between gap-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-sans">
          Configs & Contexts
        </h3>

        {/* Search Input */}
        <div className="relative w-48 lg:w-56 titlebar-nodrag shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-550 z-10" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search contexts..."
            size="sm"
            className="pl-8 bg-surface-2 border border-border-dark text-[11px] outline-none text-zinc-350 focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Collapsible Config Tree list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-[300px]">
        {allConfigs.map((configPath) => {
          const isDefault = configPath === 'default';
          const filename = isDefault
            ? 'Default Config'
            : configPath.split(/[/\\]/).pop() || configPath;
          const displayPath = isDefault ? '~/.kube/config' : configPath;

          const configContexts = contextsMap[configPath] || [];
          const isLoading = loadingMap[configPath];
          const error = errorMap[configPath];
          const isExpanded = expandedConfigs[configPath];

          // Filter contexts based on search input
          const filteredContexts = configContexts.filter((ctx) => {
            const matchesSearch =
              ctx.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (ctx.server && ctx.server.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesSearch;
          });

          // Skip rendering if search is active and this config folder has zero matches
          if (searchTerm && filteredContexts.length === 0) return null;

          return (
            <div key={configPath} className="flex flex-col select-none">
              {/* Folder Node Header */}
              <div className="flex items-center justify-between group/folder hover:bg-surface-3/30 py-1 px-1.5 rounded transition-colors">
                <button
                  onClick={() => toggleExpand(configPath)}
                  className="flex-1 flex items-center gap-1.5 text-xs text-left text-zinc-400 font-semibold cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-3.5 text-zinc-500 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 text-zinc-500 shrink-0" />
                  )}
                  <Folder className="size-4 text-zinc-500 shrink-0 fill-zinc-500/10" />
                  <span className="truncate pr-1 max-w-[200px]" title={filename}>
                    {filename}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-normal shrink-0">
                    ({filteredContexts.length})
                  </span>
                </button>

                <div className="flex items-center gap-1 opacity-0 group-hover/folder:opacity-100 transition-opacity pl-2">
                  <span
                    className="text-[9px] font-mono text-zinc-650 truncate max-w-40"
                    title={displayPath}
                  >
                    {displayPath}
                  </span>
                  {!isDefault && (
                    <button
                      onClick={() => onRemoveConfig(configPath)}
                      className="size-5 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 flex items-center justify-center cursor-pointer transition-colors"
                      title="Remove Config"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Folder Content items */}
              {isExpanded && (
                <div className="flex flex-col pl-6 border-l border-border-dark/30 ml-3.5 mt-0.5 gap-0.5">
                  {isLoading && (
                    <div className="flex items-center gap-2 py-1 px-2.5 text-[10px] text-zinc-500 italic">
                      <Loader2 className="size-3 animate-spin text-accent" />
                      Loading contexts...
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-1.5 py-1 px-2.5 text-[10px] text-red-400 leading-4">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {!isLoading && !error && filteredContexts.length === 0 && (
                    <p className="py-1 px-2.5 text-[10px] text-zinc-500 italic">
                      No contexts available in this config.
                    </p>
                  )}

                  {!isLoading &&
                    !error &&
                    filteredContexts.map((ctx) => {
                      const isConnected =
                        ctx.name === activeContext && activeConfigPath === configPath;
                      return (
                        <button
                          key={ctx.name}
                          onClick={() => onConnect(ctx.name, configPath, ctx.server, ctx.namespace)}
                          onContextMenu={(e) => handleContextMenu(e, ctx, configPath)}
                          className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded text-left cursor-pointer transition-colors ${
                            isConnected
                              ? 'bg-accent/10 text-white font-semibold'
                              : 'text-zinc-400 hover:bg-surface-3/30 hover:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Globe
                              className={`size-3.5 shrink-0 ${
                                isConnected ? 'text-accent' : 'text-zinc-500'
                              }`}
                            />
                            <div className="truncate pr-2">
                              <span className="text-xs font-semibold">
                                {highlightText(ctx.name, searchTerm)}
                              </span>
                              <span className="text-[9px] text-zinc-500 pl-2 font-mono truncate">
                                {highlightText(ctx.server || ctx.cluster, searchTerm)}
                              </span>
                            </div>
                          </div>

                          {isConnected && (
                            <span className="size-2 rounded-full bg-emerald-400 shrink-0 shadow-emerald-500/20 shadow-sm" />
                          )}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {contextMenu && contextMenu.show && (
        <div
          className="fixed bg-surface-2 border border-border-dark shadow-2xl rounded-lg py-1 z-[9999] text-xs font-sans w-52 text-zinc-300 animate-in fade-in zoom-in-95 duration-105 select-none"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onConnect(
                contextMenu.contextName,
                contextMenu.configPath,
                contextMenu.server,
                contextMenu.namespace
              );
              handleCloseContextMenu();
            }}
            className="w-full px-3 py-1.5 hover:bg-accent hover:text-white text-left cursor-pointer transition-colors flex items-center gap-2 group/item"
          >
            <Globe className="size-3.5 text-zinc-500 group-hover/item:text-white" />
            <span>Connect Context</span>
          </button>

          <button
            onClick={() => {
              handleConnectNewInstance(
                contextMenu.contextName,
                contextMenu.configPath,
                contextMenu.server,
                contextMenu.namespace
              );
              handleCloseContextMenu();
            }}
            className="w-full px-3 py-1.5 hover:bg-accent hover:text-white text-left cursor-pointer transition-colors flex items-center gap-2 border-t border-border-dark/30 mt-1 pt-1 group/item"
          >
            <Folder className="size-3.5 text-zinc-500 group-hover/item:text-white" />
            <span>Connect on New Instance</span>
          </button>
        </div>
      )}
    </div>
  );
};
