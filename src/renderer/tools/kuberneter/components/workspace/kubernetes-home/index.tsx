import React, { useState } from 'react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { ActionsPanel } from './ActionsPanel';
import { RecentList } from './RecentList';
import { ConfigTree } from './ConfigTree';
import { PasteConfigModal } from './PasteConfigModal';
import { Server, AlertCircle } from 'lucide-react';

export const KuberneterHomeView: React.FC = () => {
  const {
    activeInstanceId,
    kuberneterKubeconfigs,
    addKuberneterKubeconfig,
    removeKuberneterKubeconfig,
    kuberneterInstanceCluster,
    setKuberneterInstanceCluster,
    setKuberneterInstanceNamespace,
    kuberneterInstanceConfigPath,
    setKuberneterInstanceConfigPath,
    kuberneterRecentConnections,
    addKuberneterRecentConnection
  } = useLayoutStore();

  const activeConfigPath = kuberneterInstanceConfigPath[activeInstanceId] || 'default';
  const activeContext = kuberneterInstanceCluster[activeInstanceId] || '';

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Trigger loading file from local disk
  const handleAddFile = async () => {
    setErrorMsg(null);
    try {
      const filePath = await window.kuberneter.selectKubeconfigFile();
      if (filePath) {
        addKuberneterKubeconfig(filePath);
        setKuberneterInstanceConfigPath(activeInstanceId, filePath);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to select Kubeconfig file.');
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
    setKuberneterInstanceConfigPath(activeInstanceId, configPath);
    setKuberneterInstanceNamespace(activeInstanceId, namespace || 'default');

    // 2. Add connection info to the Recents list
    addKuberneterRecentConnection(contextName, configPath, server);
  };

  // Handler to save config after paste
  const handleSavePastedConfig = async (content: string, filename: string) => {
    return await window.kuberneter.saveKubeconfig(content, filename);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 min-w-0 bg-surface text-zinc-300">
      {/* Header Info */}
      <div className="shrink-0 border-b border-border-dark pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 font-sans tracking-tight">
          <Server className="size-5 text-accent fill-accent/10" />
          Kuberneter Connection Manager
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5 font-medium">
          Manage local contexts and connect to actual cluster configurations in real-time.
        </p>
      </div>

      {errorMsg && (
        <div className="shrink-0 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs leading-5">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="font-semibold">{errorMsg}</div>
        </div>
      )}

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
            onRemoveConfig={removeKuberneterKubeconfig}
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
export default KuberneterHomeView;
