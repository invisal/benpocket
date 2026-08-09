import type React from 'react';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { usePersistStore } from '@renderer/hooks/usePersistStore';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { ActionsPanel } from './ActionsPanel';
import { RecentList } from './RecentList';
import { ConfigTree } from './ConfigTree';
import { PasteConfigModal } from './PasteConfigModal';
import { ErrorBanner } from '../../shared/ErrorBanner';
import { KuberneterToastContainer } from '../../shared/KuberneterToastContainer';
import { Home } from 'lucide-react';

interface SyncedKubeconfig {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

const KUBERNETER_CONFIG_KEY = 'kuberneter/configfile';

export const KuberneterHomeView: React.FC = () => {
  const { activeInstanceId, openTab } = useLayoutStore();

  const {
    kuberneterKubeconfigs,
    addKuberneterKubeconfig,
    removeKuberneterKubeconfig,
    setKuberneterKubeconfigs,
    kuberneterInstanceCluster,
    setKuberneterInstanceCluster,
    setKuberneterInstanceServer,
    setKuberneterInstanceNamespace,
    kuberneterInstanceConfigPath,
    setKuberneterInstanceConfigPath,
    setKuberneterInstanceResource,
    kuberneterRecentConnections,
    addKuberneterRecentConnection
  } = useKuberneterStore();

  const { isLoading, doc } = usePersistStore(KUBERNETER_CONFIG_KEY, () => new Y.Doc());
  const map = doc.getMap<string>(KUBERNETER_CONFIG_KEY);

  const activeConfigPath = kuberneterInstanceConfigPath[activeInstanceId] || '';
  const activeContext = kuberneterInstanceCluster[activeInstanceId] || '';

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync Yjs persisted map with local store on mount/update across devices
  useEffect(() => {
    if (isLoading) return;

    const syncFromYjs = async () => {
      const keys = Array.from(map.keys());
      const localPaths: string[] = [];

      for (const key of keys) {
        const val = map.get(key);
        if (!val) continue;

        let entry: SyncedKubeconfig | null = null;
        try {
          if (val.startsWith('{')) {
            entry = JSON.parse(val) as SyncedKubeconfig;
          }
        } catch {
          // Backward compatibility for raw file path strings
        }

        if (entry && entry.content) {
          const res = await window.kuberneter.syncCloudKubeconfig(
            entry.id,
            entry.name,
            entry.content
          );
          if (typeof res === 'string') {
            localPaths.push(res);
          }
        } else {
          localPaths.push(val);
        }
      }

      if (localPaths.length > 0) {
        const currentPaths = useKuberneterStore.getState().kuberneterKubeconfigs;
        if (
          localPaths.length !== currentPaths.length ||
          localPaths.some((p, i) => p !== currentPaths[i])
        ) {
          setKuberneterKubeconfigs(localPaths);
        }
      }
    };

    syncFromYjs();
    map.observe(syncFromYjs);
    return () => map.unobserve(syncFromYjs);
  }, [isLoading, map, setKuberneterKubeconfigs]);

  // Trigger loading file from local disk
  const handleAddFile = async () => {
    setErrorMsg(null);
    try {
      const filePath = await window.kuberneter.selectKubeconfigFile();
      if (filePath) {
        const readResult = await window.kuberneter.readKubeconfigFile(filePath);
        if (readResult.error || !readResult.content) {
          setErrorMsg(readResult.error || 'Failed to read Kubeconfig file content.');
          return;
        }

        const id = readResult.name || `config-${Date.now()}`;
        const syncedData: SyncedKubeconfig = {
          id,
          name: readResult.name || 'config',
          content: readResult.content,
          updatedAt: Date.now()
        };

        addKuberneterKubeconfig(filePath);
        if (!isLoading) {
          map.set(id, JSON.stringify(syncedData));
        }
        setKuberneterInstanceConfigPath(activeInstanceId, filePath);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || 'Failed to select Kubeconfig file.');
    }
  };

  // Handler to remove a config file
  const handleRemoveConfig = (filePath: string) => {
    removeKuberneterKubeconfig(filePath);
    if (!isLoading) {
      for (const key of Array.from(map.keys())) {
        const val = map.get(key);
        if (key === filePath || val === filePath) {
          map.delete(key);
        } else if (val && val.startsWith('{')) {
          try {
            const entry = JSON.parse(val) as SyncedKubeconfig;
            if (entry.id === key) {
              map.delete(key);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  };

  // Trigger connection context switch
  const handleConnectContext = (
    contextName: string,
    configPath: string,
    server?: string,
    namespace?: string
  ) => {
    // 1. Set connection cluster and namespace context
    setKuberneterInstanceCluster(activeInstanceId, contextName);
    setKuberneterInstanceServer(activeInstanceId, server || '');
    setKuberneterInstanceConfigPath(activeInstanceId, configPath);
    setKuberneterInstanceNamespace(activeInstanceId, namespace || 'default');
    setKuberneterInstanceResource(activeInstanceId, 'overview');

    // 2. Open default Cluster Overview workspace tab
    openTab({
      id: `kuberneter-k8s-overview-${activeInstanceId}`,
      title: 'Cluster Overview',
      type: 'kuberneter',
      instanceId: activeInstanceId,
      meta: { resource: 'overview' },
      isPreview: true
    });

    // 3. Add connection info to the Recents list
    addKuberneterRecentConnection(contextName, configPath, server);
  };

  // Handler to save config after paste
  const handleSavePastedConfig = async (content: string, filename: string) => {
    const res = await window.kuberneter.saveKubeconfig(content, filename);
    if (typeof res === 'string') {
      const id = filename || `config-${Date.now()}`;
      const syncedData: SyncedKubeconfig = {
        id,
        name: filename,
        content,
        updatedAt: Date.now()
      };

      addKuberneterKubeconfig(res);
      if (!isLoading) {
        map.set(id, JSON.stringify(syncedData));
      }
      setKuberneterInstanceConfigPath(activeInstanceId, res);
    }
    return res;
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 min-w-0 bg-surface text-zinc-300 p-4 relative">
      <KuberneterToastContainer />
      {/* Header Info */}
      <div className="shrink-0 border-b border-border-dark pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 font-sans tracking-tight">
          <Home className="size-5 text-accent fill-accent/10" />
          Home
        </h2>
      </div>

      {errorMsg && <ErrorBanner error={errorMsg} />}

      {/* Main Connection Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 min-h-0 min-w-0">
        {/* Left Side: Start Actions & Recent Connections (4 cols) */}
        <div className="md:col-span-4 flex flex-col gap-8 min-h-0">
          <ActionsPanel onAddFile={handleAddFile} onPasteClick={() => setShowPasteModal(true)} />
          <RecentList
            recents={kuberneterRecentConnections}
            activeContext={activeContext}
            onConnect={handleConnectContext}
          />
        </div>

        {/* Divider Column in Middle */}
        <div className="hidden md:block w-px bg-border-dark/30 self-stretch" />

        {/* Right Side: Searchable tree of config files & contexts (7 cols) */}
        <div className="md:col-span-7 flex flex-col min-h-0 min-w-0">
          <ConfigTree
            configPaths={kuberneterKubeconfigs}
            activeConfigPath={activeConfigPath}
            activeContext={activeContext}
            onConnect={handleConnectContext}
            onRemoveConfig={handleRemoveConfig}
          />
        </div>
      </div>

      {/* Modal Dialog */}
      <PasteConfigModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onSave={handleSavePastedConfig}
      />
    </div>
  );
};
